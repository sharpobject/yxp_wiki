(async () => {
  const $ = (selector) => document.querySelector(selector);
  document.body.classList.add("recording-browser-page");
  const preferredTargetUid = "65db92284574f980c154b895"; // 愿与林小月长相守
  const assetMode = document.body.dataset.assetMode || "wiki";
  const recordingBase = document.body.dataset.recordingBase || "data";
  const recordingVersion = document.body.dataset.recordingVersion || "";
  const versionedUrl = (filename) => `${recordingBase}/${filename}${recordingVersion
    ? `?v=${encodeURIComponent(recordingVersion)}` : ""}`;
  async function loadCompressedJson(url) {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
    const bytes = new Uint8Array(await response.arrayBuffer());
    let text;
    if (bytes[0] === 0x1f && bytes[1] === 0x8b) {
      if (typeof DecompressionStream !== "function") throw new Error("this browser cannot decompress recordings");
      const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream("gzip"));
      text = await new Response(stream).text();
    } else {
      text = new TextDecoder().decode(bytes);
    }
    return JSON.parse(text);
  }
  if (!window.RECORDING_CODEC) throw new Error("recording codec did not load");
  const decodedCatalog = window.RECORDING_CODEC.unpackCatalog(
    await loadCompressedJson(versionedUrl("catalog.compact.json.gz")),
  );
  const sharedCatalog = decodedCatalog.sharedCatalog;
  const catalog = [...decodedCatalog.catalog].sort((first, second) =>
    String(first.targetUid ?? "").localeCompare(String(second.targetUid ?? ""))
      || String(second.capturedThrough ?? "").localeCompare(String(first.capturedThrough ?? "")));
  const select = $("#recording-select");
  const seasonSelect = $("#season-select");
  const timeline = $("#timeline");
  const previous = $("#previous");
  const next = $("#next");
  const roundSelect = $("#round-select");
  const filterToggle = $("#recording-filter-toggle");
  const filterPopover = $("#recording-filter-popover");
  const vaseZone = document.createElement("div");
  vaseZone.id = "vase-zone";
  vaseZone.className = "vase-zone";
  vaseZone.hidden = true;
  vaseZone.innerHTML = '<div id="vase-label" class="zone-label"></div><div id="vase" class="card-strip"></div>';
  $(".hand-zone").prepend(vaseZone);
  const seasonalWorkspace = document.createElement("section");
  seasonalWorkspace.id = "seasonal-workspace";
  seasonalWorkspace.className = "seasonal-workspace";
  seasonalWorkspace.hidden = true;
  $("#board-panel").append(seasonalWorkspace);
  const mobileViewport = matchMedia("(max-width: 760px)");
  const mobileTooltipLayer = document.createElement("div");
  mobileTooltipLayer.className = "mobile-tooltip-layer";
  mobileTooltipLayer.hidden = true;
  mobileTooltipLayer.innerHTML = `<section class="mobile-tooltip-card" role="dialog">
    <button class="mobile-tooltip-close" type="button" aria-label="Close">×</button>
    <div class="mobile-tooltip-content"></div>
  </section>`;
  document.body.append(mobileTooltipLayer);

  function closeMobileTooltip() {
    mobileTooltipLayer.hidden = true;
    mobileTooltipLayer.querySelector(".mobile-tooltip-content").replaceChildren();
  }

  function openMobileTooltip(trigger, force = false) {
    if (!mobileViewport.matches && !force) return;
    const popover = trigger.querySelector(".trait-popover");
    if (!popover) return;
    mobileTooltipLayer.querySelector(".mobile-tooltip-content").innerHTML = popover.innerHTML;
    mobileTooltipLayer.hidden = false;
  }
  const isChinese = document.documentElement.lang.toLowerCase().startsWith("zh");
  const language = isChinese ? "zh" : "en";
  const copy = isChinese ? {
    unknownPhase: "未知境界", noSideJob: "无副职业", emptySlot: "空卡位", unknownCard: "未知卡牌",
    inspect: "查看上一轮公开状态", upcomingOpponent: "下一位对手", immortalFates: "仙命",
    heavenlyDerivation: "天衍仙命", noneVisible: "暂无可见信息", cultivation: "修为", destiny: "命元", physique: "体魄", maxHp: "生命上限",
    exchangeChance: "换牌机会", currentView: "当前私密视角", previousView: "上一轮公开状态",
    deck: "卡组", previousDeck: "上一轮卡组", hand: "手牌", slots: "格", noDeck: "未记录到可见卡组。",
    hiddenHand: "查看其他玩家时无法看到其手牌。", round: "第", roundSuffix: "轮",
    rerollsRemaining: "次刷新剩余", selectHdf: "选择天衍仙命",
    selectTalent: "选择仙命", selectDaoYun: "选择卡牌", noActions: "尚无玩家操作。",
    jumpRound: "跳转到轮次…", loading: "正在载入…", couldNotLoad: "无法载入", noRecordings: "没有完整录像。",
    rating: "分", rounds: "轮", currentPrivate: "当前私密视角", cupPreliminary: "天衍杯初赛", cupFinal: "天衍杯决赛", cup: "天衍杯", practice: "练习赛",
    actionKinds: { draw: "抽牌", gain: "获得卡牌", move: "移动", rearrange: "调整", upgrade: "合成", exchange: "换牌", absorb: "吸收", destiny: "命元", leave: "离场", emote: "表情", breakthrough: "突破", sideJob: "副职业", immortalFate: "仙命", heavenlyFate: "天衍仙命", heavenlyFateUse: "使用天衍仙命", seasonalFate: "百家仙命", seasonalFateUse: "使用百家仙命", sigilMove: "移动刻印", sigilBuy: "购买刻印", sigilRefine: "炼化刻印", sigilRefresh: "刷新刻印商店", sigilReplace: "更换刻印", reroll: "刷新" },
    battle: "战斗", battleResult: "战斗结果", win: "胜", loss: "负", draw: "平", firstAction: "先手", opponentLastRound: "对手上一轮",
    previousOffer: "此前选项", rerolled: "刷新", rerolledAway: "已刷走", finalOffer: "最终选项", offer: "选项", daoYunChoices: "道韵预感", cardSelections: "卡牌选择", chosen: "已选择", innerDemon: "心魔", andOtherCards: (count) => `另有 ${count} 张牌`,
    filters: "筛选", heavenlyFateFilter: "已选择的天衍仙命", unchosenHeavenlyFateFilter: "出现但未选择的天衍仙命", sideJobFilter: "副职业", opponentFilter: "人类对手角色", anySideJob: "任意副职业", clearFilters: "清除", noMatchingRecordings: "没有符合条件的录像",
  } : {
    unknownPhase: "Unknown phase", noSideJob: "No Side Job", emptySlot: "Empty deck slot", unknownCard: "Unknown card",
    inspect: "Inspect previous-round public state", upcomingOpponent: "Upcoming opponent", immortalFates: "Immortal Fates",
    heavenlyDerivation: "Heavenly Derivation", noneVisible: "None visible", cultivation: "Cultivation", destiny: "Destiny", physique: "Physique", maxHp: "Max HP",
    exchangeChance: "Exchange Chance", currentView: "Current private view", previousView: "previous-round public state",
    deck: "Deck", previousDeck: "Previous-round deck", hand: "Hand", slots: "slots", noDeck: "No deck was visible.",
    hiddenHand: "Private hand is not visible when browsing another player.", round: "Round ", roundSuffix: "",
    rerollsRemaining: "rerolls remaining", selectHdf: "Select a Heavenly Derivation Fate",
    selectTalent: "Select an Immortal Fate", selectDaoYun: "Select a Card", noActions: "No player action has occurred yet.",
    jumpRound: "Jump to round…", loading: "Loading…", couldNotLoad: "Could not load", noRecordings: "No complete recordings are available.",
    rating: "rating", rounds: "rounds", currentPrivate: "Current private view", cupPreliminary: "Heavenly Derivation Cup preliminary", cupFinal: "Heavenly Derivation Cup final", cup: "Heavenly Derivation Cup", practice: "Practice",
    actionKinds: { draw: "Draw", gain: "Gain", move: "move", rearrange: "rearrange", upgrade: "upgrade", exchange: "exchange", absorb: "absorb", destiny: "destiny", leave: "left", emote: "emote", breakthrough: "breakthrough", sideJob: "Side Job", immortalFate: "Immortal Fate", heavenlyFate: "Heavenly Derivation", heavenlyFateUse: "used Heavenly Derivation", seasonalFate: "Hundred Schools", seasonalFateUse: "used Hundred Schools", sigilMove: "Move sigil", sigilBuy: "Buy sigil", sigilRefine: "Refine sigil", sigilRefresh: "Refresh sigil shop", sigilReplace: "Replace sigil", reroll: "reroll" },
    battle: "battle", battleResult: "Battle result", win: "Win", loss: "Loss", draw: "Draw", firstAction: "Acts first", opponentLastRound: "Opponent · last round",
    previousOffer: "Previous offer", rerolled: "Rerolled", rerolledAway: "Rerolled away", finalOffer: "Final offer", offer: "Offer", daoYunChoices: "Daoist Rhyme Omens", cardSelections: "Card selections", chosen: "Chosen", innerDemon: "Inner Demon", andOtherCards: (count) => `and ${count} other cards`,
    filters: "Filters", heavenlyFateFilter: "Chosen Heavenly Derivation Fates", unchosenHeavenlyFateFilter: "Offered but not chosen", sideJobFilter: "Side Job", opponentFilter: "Human opponent characters", anySideJob: "Any Side Job", clearFilters: "Clear", noMatchingRecordings: "No matching recordings",
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
  const baseMaxHpByPhase = { 1: 40, 2: 45, 3: 52, 4: 62, 5: 75, 6: 100 };
  const battleBuffMetadata = {
    17: ["Will of Desperate Combat", "死战之志", "After HP drops to 0 or below for the first time, cannot be defeated until the end of this turn.", "首次生命降至0或以下后，本回合结束前不会战败。"],
    10008: ["Origin Herb", "归元草", "At battle start, gain HP and Max HP.", "战斗开始时增加生命及生命上限。"],
    10009: ["Shuttle Orchid", "金梭兰", "At battle start, deal damage.", "战斗开始时造成伤害。"],
    10010: ["Healing Chamomile", "愈甘菊", "At battle start, gain Regeneration.", "战斗开始时获得恢复。"],
    10011: ["Divine Power Grass", "神力草", "At battle start, gain Increase ATK.", "战斗开始时获得加攻。"],
    10012: ["Flying Owl Reishi", "飞枭灵芝", "At battle start, gain Speed.", "战斗开始时增加速度。"],
    10013: ["Toxic Purple Fern", "穿肠紫蕨", "At battle start, apply Internal Injury to the opponent.", "战斗开始时向对方施加内伤。"],
    10014: ["Rock Herb", "归岩草", "At battle start, gain DEF.", "战斗开始时增加防。"],
    10017: ["Fire Orchid", "火梭兰", "At battle start, reduce the opponent's Max HP.", "战斗开始时减少对方生命上限。"],
    10018: ["Lose Power Grass", "失力草", "At battle start, apply Decrease ATK to the opponent.", "战斗开始时向对方施加减攻。"],
    10019: ["Clear Chamomile", "清甘菊", "At battle start, gain Hexproof.", "战斗开始时获得辟邪。"],
    10020: ["Shadow Owl Reishi", "影枭灵芝", "At battle start, lose HP, then Chase after the first card played.", "战斗开始时自身失去生命，首次使用牌后再次行动。"],
    10037: ["Saved Hexagram", "保存的卦象", "Gain the displayed number of saved Hexagram stacks at battle start.", "战斗开始时获得所示层数的已保存卦象。"],
    10045: ["Ambush", "偷袭", "The displayed number is how many Ambush charges were used for this battle; each charge grants 6 Speed.", "所示数字为本场战斗使用的偷袭次数；每次使速度增加6。"],
    10047: ["Protective Artifact", "护身法宝", "Begin this battle with the displayed number of Guard Up stacks.", "本场战斗开始时获得所示层数的护体。"],
  };
  let recording = null;
  let states = [];
  let index = 0;
  let selectedUid = "";
  let selectionFollowsPrivate = true;
  let activeCatalogItem = null;
  let loadGeneration = 0;

  const esc = (value) => String(value ?? "").replace(/[&<>"']/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[character]);
  const cardAsset = (id) => {
    return assetMode === "local" ? `card-images/${id}_${language}.png` : (window.YxpCards?.source(`${id}_${language}`) ?? `/yxp_wiki/assets/cards/${id}_${language}.webp`);
  };
  const fateCardArt = id => assetMode === "local" ? `fate-card-art/${id}.webp` : `/yxp_wiki/assets/fate-card-art/${id}.webp`;
  const specialCardArt = (id) => assetMode === "local"
    ? `special-card-art/${id}.png`
    : `/yxp_wiki/assets/recordings/special-cards/${id}.webp`;
  const characterAsset = (player, kind, defaultOnly = false) => {
    const skinNumber = Number(player?.skinNumber) || 0;
    const suffix = !defaultOnly && skinNumber > 0
      ? kind === "avatar" ? `avatar-${skinNumber}` : `skin-${skinNumber}`
      : kind;
    return assetMode === "local"
      ? `character-images/${player?.characterId}-${suffix}.png`
      : `/yxp_wiki/assets/characters/${player?.characterId}-${suffix}.webp`;
  };
  const careerAsset = (id) => assetMode === "local"
    ? `career-icons/Icon_Career_${id}.png`
    : `/yxp_wiki/assets/recordings/careers/Icon_Career_${id}.webp`;
  const fateAsset = (entry, kind) => {
    if (kind === "xianMoStrategy") {
      const iconFile = entry.iconFile || `Icon_XianMoStrategy_${entry.id}.webp`;
      return assetMode === "local" ? `hundred-schools-icons/${iconFile.replace(/\.png$/i, ".webp")}`
        : `/yxp_wiki/assets/hundred-schools/icons/${iconFile.replace(/\.png$/i, ".webp")}`;
    }
    if (kind === "talent" && [10199,20199,30199,40199,50199].includes(Number(entry.iconId))) {
      return assetMode === "local" ? `vase-icons/Icon_Talent_${entry.iconId}.webp`
        : `/yxp_wiki/assets/recordings/vase-icons/Icon_Talent_${entry.iconId}.webp`;
    }
    const iconFile = kind === "talent"
      ? `Icon_Talent_${entry.iconId || entry.id}.png`
      : entry.iconFile || `Icon_FateStrategy_${entry.id}.png`;
    if (assetMode === "local") return `fate-icons/${iconFile}`;
    return `/yxp_wiki/assets/fates/${iconFile.replace(/\.png$/i, ".webp")}`;
  };
  const buffAsset = (id) => {
    if (Number(id) === 10045) {
      return assetMode === "local"
        ? "fate-icons/Icon_FateStrategy_20.png"
        : "/yxp_wiki/assets/fates/Icon_FateStrategy_20.webp";
    }
    const iconId = Number(id) === 10047 ? 5 : Number(id);
    return assetMode === "local"
      ? `buff-icons/Icon_Buff_${iconId}.png`
      : `/yxp_wiki/assets/recordings/buffs/Icon_Buff_${iconId}.webp`;
  };
  const emojiAsset = (id) => assetMode === "local"
    ? `emoji-images/${id}.png`
    : `/yxp_wiki/assets/recordings/emojis/${id}.webp`;
  const fateArtwork = (entry = {}, kind, alt = "") => {
    if (kind === "xianMoStrategy" && entry.isSkip) {
      return `<span class="fate-skip" role="img" aria-label="${esc(alt || (isChinese ? "跳过" : "Skip"))}">↷</span>`;
    }
    if (["fateStrategy", "xianMoStrategy"].includes(kind) && entry.compositeCardIds?.length === 2) {
      const artwork = kind === "xianMoStrategy" && entry.compositeIconFiles?.length === 2
        ? entry.compositeIconFiles.map((iconFile) => fateAsset({ iconFile }, kind))
        : entry.compositeCardIds.map(fateCardArt);
      return `<span class="fate-composite" role="img" aria-label="${esc(alt)}">
        <span class="fate-composite-card first"><img data-asset-fallback src="${artwork[0]}" alt=""></span>
        <span class="fate-composite-card second"><img data-asset-fallback src="${artwork[1]}" alt=""></span>
        <span class="fate-composite-ink" aria-hidden="true"></span>
      </span>`;
    }
    if (["fateStrategy", "xianMoStrategy"].includes(kind) && /^Card_\d+\.(?:png|webp)$/.test(entry.iconFile ?? "")) {
      return `<span class="fate-card-crop" role="img" aria-label="${esc(alt)}"><img data-asset-fallback src="${fateAsset(entry, kind)}" alt=""></span>`;
    }
    return `<img data-asset-fallback src="${fateAsset(entry, kind)}" alt="${esc(alt)}">`;
  };
  const numericPrefix = (value) => Number.parseInt(String(value ?? "0"), 10) || 0;
  const localizedPair = (pair, fallback = "") => pair ? pair[isChinese ? 1 : 0] : fallback;
  const localizedInfo = (info, field = "name") => {
    const value = info?.[`${field}${isChinese ? "Chinese" : "English"}`]
      || info?.[`${field}${isChinese ? "English" : "Chinese"}`] || "";
    return typeof value === "string" ? value.replace(/\\n/g, "\n") : value;
  };
  const phaseName = (value) => localizedPair(vocabulary.phases[numericPrefix(value)], String(value ?? copy.unknownPhase));
  const priorMaxHp = (prior) => Number(baseMaxHpByPhase[numericPrefix(prior?.phase)] ?? 0) + Number(prior?.extraMaxHp ?? 0);
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

  // Native CardItem.CheckJianZhaoRongHuiAllTypeFlag: rarity is the
  // ten-thousands pair; enlightened base IDs come from talent 189's public data.
  function countsAsAllSwords(id, owner) {
    const value = Number(id);
    if (!(value > 0)) return false;
    const base = value - (Math.floor(value / 10000) % 100) * 10000;
    return base === 213 || ((owner?.talents ?? []).some(t => Number(t?.id ?? t) === 192)
      && (owner?.enlightenedCards ?? []).includes(base));
  }

  function swordMarker(id, owner) {
    if (!countsAsAllSwords(id, owner)) return "";
    const label = isChinese ? "同时视作云剑、狂剑、灵剑和剑阵" : "Counts as Cloud Sword, Unrestrained Sword, Spirit Sword, and Sword Formation";
    const src = assetMode === "local" ? "card-markers/all-sword.webp" : "/yxp_wiki/assets/recordings/card-markers/all-sword.webp";
    return `<img class="all-sword-marker" src="${src}" alt="${label}" title="${label}">`;
  }

  function card(id, zeroAsNormalAttack = false, owner = null) {
    if (!id && !zeroAsNormalAttack) return `<div class="empty-slot" title="${esc(copy.emptySlot)}"></div>`;
    const cardId = id || 0;
    const info = recording.catalog.cards[cardId] ?? (cardId === 0
      ? { id: 0, nameEnglish: "Normal Attack", nameChinese: "普通攻击", upgrade: 1 }
      : { id: cardId, nameEnglish: `Card ${cardId}`, nameChinese: `卡牌 ${cardId}`, upgrade: 1 });
    const dynamic = window.CLEAR_HEART.describe(cardId, owner, window.CLEAR_HEART_DATA, isChinese ? "zh" : "en");
    if (dynamic) {
      const base = assetMode === "local" ? "clear-heart" : "/yxp_wiki/assets/recordings/clear-heart";
      const lang = isChinese ? "zh" : "en";
      return `<div class="game-card dynamic-clear-heart" title="${esc(dynamic.title)}">
        <img src="${window.YxpCards?.sourceUrl(`${base}/${dynamic.background}_${lang}.webp?v=2`) ?? `${base}/${dynamic.background}_${lang}.webp?v=2`}" alt="${esc(dynamic.title)}">
        ${window.CLEAR_HEART.svg(dynamic, window.CLEAR_HEART_DATA, lang, base)}
        ${swordMarker(cardId, owner)}
      </div>`;
    }
    const name = localizedInfo(info) || copy.unknownCard;
    const level = isChinese ? `${info.upgrade ?? 1}级` : `Lv.${info.upgrade ?? 1}`;
    if (info.placeholder) return `<div class="game-card placeholder-card" title="${esc(name)}"><span class="card-fallback"><strong>${esc(name)}</strong></span><img data-asset-fallback src="${cardAsset(399)}" alt="${esc(name)}"></div>`;
    if (Number(cardId) === -1) return `<div class="game-card special-card" title="${esc(name)} ${esc(level)}"><img data-asset-fallback class="card-special-art" src="${specialCardArt(cardId)}" alt=""><span class="special-card-name"><strong>${esc(name)}</strong><small>${esc(level)}</small></span></div>`;
    return `<div class="game-card" title="${esc(name)} ${esc(level)}">
      <span class="card-fallback"><strong>${esc(name)}</strong><small>${esc(level)}</small></span>
      <img data-asset-fallback src="${cardAsset(cardId)}" alt="${esc(name)}">
      ${owner ? swordMarker(cardId, owner) : ""}
    </div>`;
  }

  // Compare adjacent recording states, never the last rendered view: seeking and
  // backwards navigation must show exactly the same transition as stepping forward.
  function cardTransition(before, after, step) {
    const deck = (after?.privatePlayer?.deck ?? []).map(id => ({ id, change: "" }));
    const hand = (after?.privatePlayer?.hand ?? []).map(id => ({ id, change: "" }));
    const vase = Array.from({length: 3}, (_, i) => ({id: after?.privatePlayer?.cardStorage?.[199]?.[i] || 0, change: ""}));
    const result = { deck, hand, vase, deckPrevious: null };
    if (!before || step?.battle ||
        before.privatePlayer?.uid !== after.privatePlayer?.uid) return result;
    if (before.round !== after.round) {
      // A round-start hand already includes its draws. Highlight only new
      // copies; round changes must not produce red history or deck highlights.
      if (Number(after.round) > Number(before.round)) {
        const retained = [...(before.privatePlayer?.hand ?? [])];
        for (const entry of hand) {
          const match = retained.indexOf(entry.id);
          if (match < 0) entry.change = "appear";
          else retained.splice(match, 1);
        }
      }
      return result;
    }
    const actions = step?.humanActions ?? [];
    if (!actions.some(action => ["move", "rearrange", "exchange", "upgrade", "absorb", "draw", "gain"].includes(action.kind))) return result;
    for (let slot = 0; slot < vase.length; slot++) {
      const old = before.privatePlayer?.cardStorage?.[199]?.[slot] || 0;
      if (old === vase[slot].id) continue;
      if (vase[slot].id) vase[slot].change = "appear";
      else if (old) vase[slot] = {id: old, change: "leaving"};
    }
    const upgrading = actions.some(action => ["upgrade", "absorb"].includes(action.kind));
    const isUpgrade = (old, current) => {
      const base = id => id - (Math.floor(Math.abs(id) / 10000) % 100) * 10000;
      return upgrading && old > 0 && current > old && base(old) === base(current);
    };
    const oldHand = [...(before.privatePlayer?.hand ?? [])];
    // Match copies, not IDs as a set. Removing the first copy must not mark all
    // the surviving identical cards or shifted hand positions as new.
    for (const entry of hand) {
      const match = oldHand.indexOf(entry.id);
      if (match < 0) entry.change = "appear";
      else oldHand.splice(match, 1);
    }
    // An upgraded target continues as the green card. Only the consumed copy
    // (or absorbed effect card) should remain red, not the target's old level.
    for (const entry of hand.filter(entry => entry.change === "appear")) {
      const target = oldHand.findIndex(old => isUpgrade(old, entry.id));
      if (target >= 0) oldHand.splice(target, 1);
    }
    hand.push(...oldHand.filter(Boolean).map(id => ({ id, change: "leaving" })));
    const oldDeck = before.privatePlayer?.deck ?? [];
    const previousDeckCards = [];
    for (let slot = 0; slot < Math.max(oldDeck.length, deck.length); slot++) {
      const old = oldDeck[slot] || 0;
      const current = deck[slot]?.id || 0;
      if (old === current) continue;
      if (current) deck[slot].change = "appear";
      if (!old || isUpgrade(old, current)) continue;
      if (!current) {
        // An emptied slot can show its previous card without an extra position.
        deck[slot] = { id: old, change: "leaving" };
      } else {
        previousDeckCards.push({ id: old, change: "leaving", slot: slot + 1 });
      }
    }
    // Rearrangements already show the changed deck positions. Only other
    // operations need an extra historical card when its old slot is occupied.
    if (!actions.some(action => action.kind === "rearrange")) {
      // A hand-to-deck swap already shows the displaced copy in hand.
      const movedToHand = actions.some(action => action.kind === "move")
        ? hand.filter(entry => entry.change === "appear").map(entry => entry.id) : [];
      result.deckPrevious = previousDeckCards.find(entry => !movedToHand.includes(entry.id)) ?? null;
    }
    return result;
  }

  function transitionCard(entry, owner = null) {
    let html = card(entry.id, false, owner);
    if (!entry.change) return html;
    const status = entry.change === "appear"
      ? (isChinese ? "新卡牌 / 新位置" : "New card / new position")
      : (isChinese ? "原卡牌 / 原位置" : "Previous card / previous position");
    html = html.replace('class="game-card', `data-card-change="${entry.change}" aria-label="${status}" class="game-card card-${entry.change}`);
    const mark = entry.change === "leaving" ? '<span class="card-change-cross" aria-hidden="true">×</span>' : '';
    const origin = entry.slot ? `<span class="card-change-origin">${isChinese ? "原卡位" : "Old slot"} ${entry.slot}</span>` : '';
    return html.replace(/<\/div>$/, `${mark}${origin}</div>`);
  }

  function transitionDeck(transition, owner, previousOwner, enchantments = []) {
    const renderCard = entry => transitionCard(entry, entry.change === "leaving" ? previousOwner : owner);
    return transition.deck.map((entry, position) => deckEnchantmentMarker(renderCard(entry), position + 1, enchantments)).join("")
      + (transition.deckPrevious ? renderCard(transition.deckPrevious) : "");
  }

  function recordedEnchantedSlot(reference) {
    const slot = reference?.enchantedSlot;
    return Number.isInteger(slot) && slot >= 1 && slot <= 8 ? slot : null;
  }

  function enchantmentSlotText(slot) {
    return isChinese ? `附魔卡位：${slot}` : `Enchanted deck slot: ${slot}`;
  }

  function deckEnchantmentMarker(html, slot, references) {
    const names = references.filter((reference) => recordedEnchantedSlot(reference) === slot)
      .map((reference) => localizedInfo(recording.catalog.xianMoStrategies?.[reference.id]) || reference.id);
    if (!names.length) return html;
    const label = `${enchantmentSlotText(slot)} · ${names.join(" · ")}`;
    return html.replace(/<\/div>$/, `<span class="deck-enchantment-marker" role="img" aria-label="${esc(label)}" title="${esc(label)}">✦ ${slot}</span></div>`);
  }

  function offerHistory(history, kind, { showFinalLabel = true } = {}) {
    if (!history?.offers?.length) return "";
    const final = history.offers.at(-1);
    const rows = ["fateStrategy", "xianMoStrategy"].includes(kind)
      ? (() => {
        const inferredRolledAway = history.offers.slice(0, -1).flatMap((offer, offerIndex) => {
          const remaining = [...history.offers[offerIndex + 1]];
          return offer.filter((id) => {
            const retainedIndex = remaining.indexOf(id);
            if (retainedIndex < 0) return true;
            remaining.splice(retainedIndex, 1);
            return false;
          });
        });
        const knownRolledAway = history.rolledAway?.length ? history.rolledAway : inferredRolledAway;
        const knownRows = history.rerolls?.length
          ? history.rerolls.map(({ from, to }) => {
            const possibleFrom = Array.isArray(from) ? from : [from];
            return {
              offer: [...possibleFrom, to], inputCount: possibleFrom.length,
              label: copy.rerolled, previous: true, transition: true,
            };
          })
          : knownRolledAway.map((id) => ({ offer: [id], label: copy.rerolledAway, previous: true }));
        return knownRows.concat([{ offer: final, label: showFinalLabel ? copy.finalOffer : "", previous: false }]);
      })()
      : kind === "card"
        ? [{ offer: final, label: "", previous: false }]
        : history.offers.map((offer, offerIndex) => ({
          offer: offerIndex === history.offers.length - 1 ? offer : offer.slice(1),
          label: offerIndex === history.offers.length - 1
            ? showFinalLabel ? copy.finalOffer : ""
            : copy.previousOffer,
          previous: offerIndex !== history.offers.length - 1,
        }));
    return `<div class="offer-history">${rows.map((row) => {
      let displayedOffer = row.offer;
      let omittedCardCount = 0;
      if (kind === "card" && row.offer.length > 6) {
        const selectedId = Number(history.selected);
        displayedOffer = row.offer.slice(0, 4);
        if (selectedId > 0 && !displayedOffer.some((id) => Number(id) === selectedId)) {
          displayedOffer[displayedOffer.length - 1] = row.offer.find((id) => Number(id) === selectedId) ?? displayedOffer.at(-1);
        }
        omittedCardCount = row.offer.length - displayedOffer.length;
      }
      const icons = displayedOffer.map((id) => {
        if (!Number(id)) return '<span class="offer-icon unknown" aria-label="?">?</span>';
        const info = kind === "card" ? recording.catalog.cards[id]
          : kind === "talent" ? recording.catalog.talents[id]
            : kind === "xianMoStrategy" ? recording.catalog.xianMoStrategies?.[id] : recording.catalog.fateStrategies[id];
        const selected = !row.previous && Number(id) === Number(history.selected);
        const name = localizedInfo(info) || id;
        const artwork = kind === "card"
          ? `<img data-asset-fallback src="${cardAsset(id)}" alt="${esc(name)}">`
          : fateArtwork(info ?? { id }, kind, name);
        return `<span class="offer-icon${kind === "card" ? " card-art" : ""}${selected ? " selected" : ""}" title="${esc(name)}">${artwork}</span>`;
      });
      if (omittedCardCount > 0) icons.push(`<span class="offer-icon offer-more" title="${esc(copy.andOtherCards(omittedCardCount))}">${esc(copy.andOtherCards(omittedCardCount))}</span>`);
      const contents = row.transition && !row.unknown
          ? `<span class="reroll-inputs">${icons.slice(0, row.inputCount).join("")}</span><span class="reroll-arrow" aria-hidden="true">→</span>${icons.at(-1)}`
          : row.unknown ? '<span class="offer-icon unknown" aria-label="?">?</span>' : icons.join("");
        return `<div class="offer-row${row.previous ? " previous" : " final"}">${row.label ? `<small>${esc(row.label)}</small>` : ""}<div>${contents}</div></div>`;
    }).join("")}</div>`;
  }

  function trait(reference, kind, { hasMyFateMyChoice = false, iconId = null } = {}) {
    const info = kind === "talent" ? recording.catalog.talents[reference.id] : kind === "xianMoStrategy" ? recording.catalog.xianMoStrategies?.[reference.id] : recording.catalog.fateStrategies[reference.id];
    if (!info) return "";
    const runtime = reference.runtime;
    const badgeText = runtime?.kind === "cooldown"
      ? isChinese ? `冷却${runtime.value}轮` : `CD ${runtime.value}`
      : runtime?.value;
    const badge = runtime
      ? `<span class="trait-count${runtime.kind === "cooldown" ? " cooldown" : ""}">${esc(badgeText)}</span>`
      : "";
    const name = localizedInfo(info);
    const localizedDescription = localizedInfo(info, "description");
    const enchantedSlot = kind === "xianMoStrategy" ? recordedEnchantedSlot(reference) : null;
    const slotDescription = enchantedSlot == null ? "" : enchantmentSlotText(enchantedSlot);
    const slotBadge = enchantedSlot == null ? "" : `<span class="trait-enchanted-slot" title="${esc(slotDescription)}" aria-label="${esc(slotDescription)}">✦${enchantedSlot}</span>`;
    const runtimeCardId = kind === "xianMoStrategy" && Number.isInteger(reference.runtimeCardId) && reference.runtimeCardId > 0
      ? reference.runtimeCardId : null;
    const runtimeCardName = runtimeCardId == null ? "" : localizedInfo(recording.catalog.cards[runtimeCardId])
      || (isChinese ? `卡牌 ${runtimeCardId}` : `Card ${runtimeCardId}`);
    const runtimeCardDescription = runtimeCardId == null ? ""
      : reference.runtimeCardKind === "stored"
        ? (isChinese ? `待返回手牌：${runtimeCardName}` : `Pending return to hand: ${runtimeCardName}`)
        : reference.runtimeCardKind === "selected"
          ? (isChinese ? `已选择卡牌：${runtimeCardName}` : `Selected card: ${runtimeCardName}`) : "";
    const selectedCareer = kind === "talent" && Math.abs(Number(reference.id)) % 10000 === 188
      ? Number(reference.additionalCareer) || 0 : 0;
    const artwork = selectedCareer
      ? `<img class="fate-artwork" src="${careerAsset(selectedCareer)}" alt="${esc(careerName(selectedCareer))}">`
      : fateArtwork(iconId ? { ...info, iconId } : info, kind, name);

    const history = reference.choiceHistory;
    const hasHeavenlyDerivationVariables = Number(history?.rerollsRemainingAtStart ?? 0) > 0
      || Number(history?.rerollsUsed ?? 0) > 0
      || Number(history?.rerollsRemaining ?? 0) > 0;
    const showFinalLabel = kind === "talent" ? hasMyFateMyChoice : hasHeavenlyDerivationVariables;
    return `<div class="trait-icon ${kind === "talent" ? "talent" : "heavenly-fate"}${reference.locked ? " locked" : ""}" tabindex="0">${artwork}${badge}${slotBadge}<div class="trait-popover"><strong>${esc(name)}</strong>${selectedCareer ? `<p>${esc(careerName(selectedCareer))}</p>` : ""}${slotDescription ? `<p>${esc(slotDescription)}</p>` : ""}${runtimeCardDescription ? `<p class="trait-runtime-card">${esc(runtimeCardDescription)}</p>` : ""}${localizedDescription ? `<p>${esc(localizedDescription)}</p>` : ""}${offerHistory(history, kind, { showFinalLabel })}</div></div>`;
  }

  function battleBuff(reference) {
    const metadata = battleBuffMetadata[Number(reference.id)] ?? [String(reference.id), String(reference.id), "", ""];
    const name = metadata[isChinese ? 1 : 0];
    const description = metadata[isChinese ? 3 : 2];
    return `<div class="battle-buff" tabindex="0"><img data-asset-fallback src="${buffAsset(reference.id)}" alt="${esc(name)}"><span class="battle-buff-count">${esc(reference.value)}</span><div class="trait-popover"><strong>${esc(name)}</strong>${description ? `<p>${esc(description)}</p>` : ""}</div></div>`;
  }

  function daoYunChoice(choice) {
    const info = recording.catalog.cards[choice.selected] ?? {};
    const name = localizedInfo(info) || choice.selected;
    const multiplier = Number(choice.multiplier) > 1
      ? `<span class="trait-count dao-multiplier">${esc(choice.multiplier)}x</span>` : "";
    return `<div class="dao-yun-choice" tabindex="0"><span class="dao-pentagon-wrap"><span class="dao-pentagon"><span class="dao-art"><img data-asset-fallback src="${cardAsset(choice.selected)}" alt="${esc(name)}"></span></span>${multiplier}<span class="trait-count dao-round-badge">${esc(choice.roundOrPhase)}</span></span><div class="trait-popover"><strong>${esc(name)}</strong><p>${esc(copy.chosen)} · ${copy.round}${esc(choice.roundOrPhase)}${copy.roundSuffix}</p>${offerHistory(choice, "card", { showFinalLabel: false })}</div></div>`;
  }

  function cardSelectionChoice(choice) {
    const info = recording.catalog.cards[choice.selected] ?? {};
    const name = localizedInfo(info) || choice.selected;
    return `<div class="card-selection-choice" tabindex="0"><span class="dao-round">${copy.round}${esc(choice.roundOrPhase)}${copy.roundSuffix}</span><span class="card-selection-art"><img data-asset-fallback src="${cardAsset(choice.selected)}" alt="${esc(name)}"></span><div class="trait-popover"><strong>${esc(name)}</strong><p>${esc(copy.chosen)} · ${copy.round}${esc(choice.roundOrPhase)}${copy.roundSuffix}</p>${offerHistory(choice, "card", { showFinalLabel: false })}</div></div>`;
  }

  // Official text-only emotes have no Spine asset.
  const textEmotes = {"12":{"en":"Cooooool","zh":"666666"},"13":{"en":"Yes Yes Yes","zh":"对的对的"},"14":{"en":"No No No","zh":"不对不对"},"15":{"en":"Awesome","zh":"妙啊"},"16":{"en":"Huh?","zh":"啊？"},"17":{"en":"Show your moves","zh":"请赐教"},"18":{"en":"Well played","zh":"承让了"},"19":{"en":"Wait a moment","zh":"请稍等"},"20":{"en":"A mistake","zh":"失误了"},"21":{"en":"Amazing","zh":"绝了"},"22":{"en":"Lucky","zh":"运气不错"},"23":{"en":"?!","zh":"？！"},"24":{"en":"Take my move","zh":"吃我一招"},"25":{"en":"Good cards!","zh":"好牌！"},"26":{"en":"Finally achieved it!","zh":"终于成了！"},"28":{"en":"Steady","zh":"稳了"},"30":{"en":"I changed my move!","zh":"我变招了！"}};

  function emoteMarkup(emojiId) {
    if (emojiId == null) return "";
    const text = textEmotes[emojiId]?.[language];
    if (text) return `<span class="player-emote text-emote" aria-label="${esc(copy.actionKinds.emote)}: ${esc(text)}">${esc(text)}</span>`;
    return `<span class="player-emote" aria-label="${esc(copy.actionKinds.emote)} ${esc(emojiId)}"><span>${esc(emojiId)}</span><img data-emote-art src="${emojiAsset(emojiId)}" alt=""></span>`;
  }

  function playerPortrait(player, state, privateOwnerUid, emojiId = null) {
    const own = state.players[privateOwnerUid];
    const upcoming = own?.nextOpponent === player.uid;
    return `<button class="player-portrait ${selectedUid === player.uid ? "selected" : ""} ${player.uid === privateOwnerUid ? "own" : ""} ${player.settled ? "settled" : ""}" data-uid="${esc(player.uid)}" data-rating="${esc(player.rating ?? 0)}" title="${esc(copy.inspect)}: ${esc(player.username)}">
      <span class="avatar-wrap"><img data-character-fallback data-default-src="${characterAsset(player, "avatar", true)}" class="avatar ${Number(player.skinNumber) > 0 ? "costume" : ""}" src="${characterAsset(player, "avatar")}" alt=""><span class="life-gem"><span>${esc(player.life)}</span></span>${upcoming ? `<span class="opponent-badge" title="${esc(copy.upcomingOpponent)}">⚔</span>` : ""}</span>
      <span class="name">${esc(player.username)}</span><span class="character-name">${esc(characterName(player))}</span>
      ${emoteMarkup(emojiId)}
    </button>`;
  }

  // Native CardGridCunQuItem.RefreshTalent199Icon uses only slot zero and
  // Chinese card-name substrings in this order; later matches override earlier ones.
  function vaseIconId(storage, cards) {
    const name = cards[storage?.[0]]?.nameChinese ?? "";
    let icon = 199;
    ["金灵", "水灵", "木灵", "火灵", "土灵"].forEach((element, i) => {
      if (name.includes(element)) icon = 10199 + i * 10000;
    });
    return icon;
  }

  function renderCharacter(player, traits, state, priorRound, privateOwnerUid) {
    const privatePlayer = state.privatePlayer;
    const hasMyFateMyChoice = (traits.fates ?? []).some((reference) => Number(reference.id) === 12);
    const talents = (traits.talents ?? []).map((value) => trait(value, "talent", { hasMyFateMyChoice,
      iconId: Number(value.id) === 199 && player.uid === privateOwnerUid
        ? vaseIconId(privatePlayer?.cardStorage?.[199], recording.catalog.cards) : null })).join("");
    const seasonal = Number(state.seasonMechanic) === 10;
    const fates = seasonal ? (traits.xianMoFates ?? []).map(value => trait(value, "xianMoStrategy")).join("")
      : (traits.fates ?? []).map(value => trait(value, "fateStrategy")).join("");
    const daoYunChoices = player.uid === privateOwnerUid
      ? (privatePlayer?.daoYunChoices ?? []).map(daoYunChoice).join("")
      : "";
    const cardSelections = player.uid === privateOwnerUid
      ? (privatePlayer?.cardSelections ?? []).map(cardSelectionChoice).join("")
      : "";
    const displayedStats = priorRound ?? player;
    const physique = Number(displayedStats?.physique ?? 0);
    const showPhysique = numericPrefix(player.sect) === 4 || physique > 0;
    const mechanic = Number(state.seasonMechanic);
    const olderMechanic = mechanic > 0 && mechanic < 9;
    const mechanicInfo = player.uid === privateOwnerUid ? privatePlayer?.seasonalInfo : priorRound?.seasonalInfo;
    const mechanicPanel = olderMechanic
      ? `<div class="trait-group seasonal-trait-group"><span class="trait-heading">${esc(seasonName(String(mechanic)))}</span>${seasonalInfoMarkup(mechanicInfo, mechanic)}</div>`
      : seasonal || mechanic === 9 || fates
        ? `<div class="trait-group"><span class="trait-heading">${esc(seasonal ? (isChinese ? "百家之道" : "The Dao of Hundred Schools") : copy.heavenlyDerivation)}</span><div class="trait-row">${fates || `<span class="trait-empty">${esc(copy.noneVisible)}</span>`}</div></div>` : "";
    $("#character-panel").innerHTML = `<div class="trait-panel">
        <div class="trait-group"><span class="trait-heading">${esc(copy.immortalFates)}</span><div class="trait-row">${talents || `<span class="trait-empty">${esc(copy.noneVisible)}</span>`}</div></div>
        ${mechanicPanel}
        ${player.uid === privateOwnerUid ? `<div class="trait-group dao-yun-group"><span class="trait-heading">${esc(copy.daoYunChoices)}</span><div class="trait-row dao-yun-row">${daoYunChoices || `<span class="trait-empty">${esc(copy.noneVisible)}</span>`}</div></div>` : ""}
        ${player.uid === privateOwnerUid && cardSelections ? `<div class="trait-group card-selection-group"><span class="trait-heading">${esc(copy.cardSelections)}</span><div class="trait-row card-selection-row">${cardSelections}</div></div>` : ""}
      </div>
      <img data-character-fallback data-default-src="${characterAsset(player, "portrait", true)}" class="character-art" src="${characterAsset(player, "portrait")}" alt="${esc(characterName(player))}">
      <div class="character-stats"><strong>${esc(player.username)}</strong><span>${esc(characterName(player))}</span><span>${esc(phaseName(displayedStats?.phase))}</span>${numericPrefix(player.career) ? `<span>${esc(careerName(player.career))}</span>` : ""}<span>${esc(displayedStats?.cultivation ?? 0)} ${esc(copy.cultivation)} · ${esc(player.life)} ${esc(copy.destiny)}</span><span>${showPhysique ? `${esc(physique)} / ${esc(displayedStats?.maxPhysique ?? 0)} ${esc(copy.physique)} · ` : ""}${esc(priorMaxHp(displayedStats))} ${esc(copy.maxHp)}</span></div>`;
  }

  function seasonalTraitMarkup(entry) {
    if (!entry || !(Number(entry.id) > 0)) return "";
    const name = localizedInfo(entry) || (isChinese ? `选项 ${entry.id}` : `Option ${entry.id}`);
    const description = localizedInfo(entry, "description");
    const status = localizedInfo(entry, "status");
    return `<span class="seasonal-trait${entry.selected ? " selected" : ""}" tabindex="0"><span>${entry.selected ? "✓ " : ""}${esc(name)}</span>${status ? `<small>${esc(status)}</small>` : ""}<span class="trait-popover"><strong>${esc(name)}</strong>${status ? `<p>${esc(status)}</p>` : ""}${description ? `<p>${esc(description)}</p>` : ""}</span></span>`;
  }

  function seasonalInfoMarkup(info, mechanic, { compact = false } = {}) {
    if (!info || Number(info.mechanic) !== Number(mechanic)) return compact ? "" : `<span class="trait-empty">${esc(copy.noneVisible)}</span>`;
    const counters = (info.counters ?? []).filter(entry => entry.value != null).map(entry =>
      `<span class="seasonal-counter"><small>${esc(localizedInfo(entry, "label"))}</small><b>${esc(entry.value)}</b></span>`).join("");
    const traits = (info.traits ?? []).map(seasonalTraitMarkup).join("");
    const offers = (info.offers ?? []).map(seasonalTraitMarkup).join("");
    const sigils = Number(mechanic) === 7 && Array.isArray(info.usedSlots)
      ? `<div class="public-sigil-deck" aria-label="${isChinese ? "刻印卡组" : "Sigil deck"}">${Array.from({ length: 3 }, (_, slot) => sigilMarkup(info.usedSlots[slot], { slot: slot + 1, deck: true })).join("")}</div>` : "";
    const mirages = Number(mechanic) === 6 && info.mirageHistory?.length
      ? `<details class="seasonal-history"><summary>${isChinese ? "此前幻景" : "Past Mirages"} · ${info.mirageHistory.length}</summary><div>${info.mirageHistory.map(mirage => `<section><strong>${esc(localizedInfo(mirage))}</strong><div class="seasonal-traits">${(mirage.options ?? []).map(seasonalTraitMarkup).join("")}</div></section>`).join("")}</div></details>` : "";
    const dreamPhases = Number(mechanic) === 8 && info.dreamPhaseUnlocks?.length
      ? `<div class="dream-phase-progression"><small>${isChinese ? "梦境卡牌境界" : "Dream card phases"}</small><div>${info.dreamPhaseUnlocks.map(phase => `<span class="dream-phase${phase.unlocked ? " unlocked" : ""}" title="${isChinese ? `第${phase.round}轮解锁` : `Unlocks round ${phase.round}`}">${esc(phaseName(phase.phase))}<small>${isChinese ? `第${phase.round}轮` : `R${phase.round}`}</small></span>`).join("")}</div></div>` : "";
    const branchRerolls = Number(mechanic) === 3 && info.refreshTalentLevels?.length
      ? `<p class="seasonal-refresh-history">${isChinese ? "已使用仙命刷新：" : "Fate rerolls used: "}${info.refreshTalentLevels.map(phase => esc(phaseName(phase))).join(" · ")}</p>` : "";
    const description = localizedInfo(info, "description");
    return `<div class="seasonal-summary${compact ? " compact" : ""}">${counters ? `<div class="seasonal-counters">${counters}</div>` : ""}${traits ? `<div class="seasonal-traits">${traits}</div>` : ""}${sigils}${offers ? `<div class="seasonal-offers"><small>${esc(copy.offer || (isChinese ? "选项" : "Offer"))}</small><div>${offers}</div></div>` : ""}${mirages}${dreamPhases}${branchRerolls}${description ? `<span class="seasonal-rules" tabindex="0">${isChinese ? "规则 ⓘ" : "Rules ⓘ"}<span class="trait-popover"><p>${esc(description)}</p></span></span>` : ""}${!counters && !traits && !offers && !sigils && !mirages && !dreamPhases && !branchRerolls && !description ? `<span class="trait-empty">${esc(copy.noneVisible)}</span>` : ""}</div>`;
  }

  function seasonalZoneEntries(zone) {
    const entries = zone.kind === "sigil" ? (zone.entries ?? []).map(entry => entry || null)
      : (zone.cards ?? []).map(id => Number(id) || 0);
    // Sigil slots are independent of their cost budget and always number three.
    const capacity = zone.kind === "sigil" && zone.id === "sigil-deck" ? 3
      : zone.id === "dream-storage" ? 2 : Number(zone.capacity);
    if (Number.isInteger(capacity) && capacity >= 0) {
      entries.length = Math.min(entries.length, capacity);
      while (entries.length < capacity) entries.push(zone.kind === "sigil" ? null : 0);
    }
    return entries;
  }

  function seasonalZoneTransition(zone, previous) {
    const current = seasonalZoneEntries(zone);
    const old = previous ? seasonalZoneEntries(previous) : [];
    const idOf = entry => Number(zone.kind === "sigil" ? entry?.id : entry) || 0;
    const fixedSlots = Number.isInteger(Number(zone.capacity)) || zone.id === "sigil-deck";
    const unmatched = [...old];
    return current.map((entry, slot) => {
      let prior = old[slot];
      if (!fixedSlots) {
        const position = unmatched.findIndex(candidate => idOf(candidate) === idOf(entry));
        prior = position >= 0 ? unmatched.splice(position, 1)[0] : null;
      }
      const changed = previous && idOf(entry) !== idOf(prior);
      const sold = previous && zone.kind === "sigil" && idOf(entry) === idOf(prior)
        && entry?.soldOut === true && prior?.soldOut !== true;
      return { entry, previous: prior, change: changed ? idOf(entry) ? "appear" : "leaving" : sold ? "sold" : "", slot: slot + 1 };
    });
  }

  function sigilMarkup(entry, { slot = null, change = "", previous = null, deck = false, shop = false } = {}) {
    const id = Number(entry?.id) || 0;
    const previousName = localizedInfo(previous);
    const name = id ? localizedInfo(entry) || (isChinese ? `刻印 ${id}` : `Sigil ${id}`)
      : (isChinese ? "空刻印槽" : "Empty sigil slot");
    const description = localizedInfo(entry, "description");
    const status = localizedInfo(entry, "status");
    const passive = entry?.passive === true || String(entry?.descriptionChinese ?? "").includes("被动生效");
    const activation = deck ? passive ? (isChinese ? "被动生效" : "Passive")
      : (isChinese ? `第${slot}回合` : `Turn ${slot}`) : "";
    const cost = entry?.keYin;
    const price = shop ? entry?.price : null;
    const previousText = previousName && change === "leaving"
      ? (isChinese ? `此前：${previousName}` : `Previously: ${previousName}`) : "";
    const artwork = id ? `<img data-asset-fallback src="${assetMode === "local"
      ? `sigil-images/KeYinCard_${id}_${language}.webp`
      : `/yxp_wiki/assets/sigils/${language}/KeYinCard_${id}_${language}.webp`}" alt="${esc(name)}">` : "";
    return `<div class="sigil-item${id ? "" : " empty-sigil"}${entry?.soldOut ? " sold-out" : ""}${change ? ` zone-${change}` : ""}" tabindex="0" data-sigil-id="${id}"${change ? ` data-zone-change="${change}"` : ""} aria-label="${esc([name, activation, previousText].filter(Boolean).join(" · "))}"><span class="sigil-fallback">${esc(name)}</span>${artwork}${cost != null && id ? `<span class="sigil-cost" title="${isChinese ? "刻印消耗" : "Sigil cost"}">${esc(cost)}</span>` : ""}${entry?.soldOut ? `<span class="sigil-sold">${isChinese ? "已购买" : "Purchased"}</span>` : price != null ? `<span class="sigil-price">${esc(price)} ${isChinese ? "换牌" : "exchanges"}</span>` : ""}${activation ? `<span class="sigil-activation">${esc(activation)}</span>` : ""}${previousText ? '<span class="zone-removed-mark" aria-hidden="true">×</span>' : ""}<div class="trait-popover"><strong>${esc(name)}</strong>${activation ? `<p>${esc(activation)}</p>` : ""}${status ? `<p>${esc(status)}</p>` : ""}${description ? `<p>${esc(description)}</p>` : ""}${cost != null && id ? `<p>${isChinese ? "刻印消耗" : "Sigil cost"}: ${esc(cost)}</p>` : ""}${price != null ? `<p>${isChinese ? "购买所需换牌次数" : "Purchase cost in exchanges"}: ${esc(price)}</p>` : ""}${previousText ? `<p>${esc(previousText)}</p>` : ""}</div></div>`;
  }

  function seasonalZoneMarkup(zone, previous, owner) {
    if (zone.id === "relic-1") return furnaceZoneMarkup(zone, previous, owner);
    if (zone.id === "relic-5") return shelfZoneMarkup(zone, previous, owner);
    const description = localizedInfo(zone, "description");
    const name = localizedInfo(zone);
    const entries = seasonalZoneTransition(zone, previous);
    let removedSigils = "";
    if (zone.id === "sigil-hand" && previous) {
      const retained = seasonalZoneEntries(zone).map(entry => Number(entry?.id));
      const removed = seasonalZoneEntries(previous).filter(entry => {
        const matched = retained.indexOf(Number(entry?.id));
        if (matched >= 0) { retained.splice(matched, 1); return false; }
        return Number(entry?.id) > 0;
      });
      if (removed.length) removedSigils = `<div class="sigil-removed-history"><small>${isChinese ? "本步移出" : "Removed this step"}</small>${removed.map(seasonalTraitMarkup).join("")}</div>`;
    }
    const contents = entries.map(({ entry, previous: prior, change, slot }) => {
      if (zone.kind === "sigil") return `<div class="seasonal-slot sigil-slot" data-zone-slot="${slot}">${sigilMarkup(entry, { slot, change, previous: prior, deck: zone.id === "sigil-deck", shop: zone.id === "sigil-shop" })}</div>`;
      const visible = change === "leaving" ? prior : entry;
      const metadata = zone.slotMetadata?.[slot - 1];
      const slotLabel = localizedInfo(metadata, "label");
      const status = [slotLabel, metadata?.locked ? (metadata.unlockRound != null
        ? (isChinese ? `第${metadata.unlockRound}轮解锁` : `Unlocks round ${metadata.unlockRound}`) : isChinese ? "未解锁" : "Locked") : "", Number(metadata?.sealCount) > 0
        ? (isChinese ? `封印：${metadata.sealCount}` : `Seal: ${metadata.sealCount}`) : ""].filter(Boolean).join(" · ");
      return `<div class="seasonal-slot stored-card-slot${metadata?.locked ? " locked" : ""}" data-zone-slot="${slot}" aria-label="${esc(name)} · ${slot}${status ? ` · ${esc(status)}` : ""}">${transitionCard({ id: visible, change }, owner)}${status ? `<span class="storage-slot-status">${esc(status)}</span>` : ""}</div>`;
    }).join("");
    return `<section class="seasonal-zone${zone.kind === "sigil" ? " sigil-zone" : " card-storage-zone"}" data-seasonal-zone="${esc(zone.id)}"><div class="seasonal-zone-heading"><strong>${esc(name)}</strong>${description ? `<span class="seasonal-rules" tabindex="0" aria-label="${esc(name)} · ${isChinese ? "规则" : "Rules"}">ⓘ<span class="trait-popover"><strong>${esc(name)}</strong><p>${esc(description)}</p></span></span>` : ""}</div><div class="seasonal-zone-slots">${contents || `<span class="trait-empty">${isChinese ? "空" : "Empty"}</span>`}</div>${removedSigils}</section>`;
  }

  function relicZoneHeading(zone) {
    const name = localizedInfo(zone), description = localizedInfo(zone, "description");
    return `<div class="seasonal-zone-heading"><strong>${esc(name)}</strong>${description ? `<span class="seasonal-rules" tabindex="0">${isChinese ? "规则 ⓘ" : "Rules ⓘ"}<span class="trait-popover"><strong>${esc(name)}</strong><p>${esc(description)}</p></span></span>` : ""}</div>`;
  }

  function furnaceZoneMarkup(zone, previous, owner) {
    const slots = seasonalZoneTransition({ ...zone, capacity: 2 }, previous).map(({ entry, previous: prior, change, slot }) =>
      `<div class="furnace-material"><small>${isChinese ? `材料 ${slot}` : `Material ${slot}`}</small><div class="seasonal-slot stored-card-slot" data-zone-slot="${slot}">${transitionCard({ id: change === "leaving" ? prior : entry, change }, owner)}</div></div>`);
    const counterKnown = typeof zone.combineCounter === "number" && Number.isFinite(zone.combineCounter);
    const available = counterKnown && zone.combineCounter < 1;
    const status = counterKnown ? available ? (isChinese ? "本轮可熔炼" : "Available this round")
      : (isChinese ? "本轮已使用" : "Used this round") : "";
    return `<section class="seasonal-zone furnace-zone" data-seasonal-zone="${esc(zone.id)}">${relicZoneHeading(zone)}<div class="furnace-workbench">${slots[0]}<div class="furnace-smelt${available ? " available" : ""}"><span class="furnace-glyph" aria-hidden="true">♨</span><strong>${isChinese ? "精华熔炼" : "Essence Smelt"}</strong>${status ? `<span class="furnace-status" role="status">${esc(status)}</span>` : ""}</div>${slots[1]}</div><p class="relic-storage-rule">${isChinese ? "常规门派牌 · 同境界 · 不同等级" : "Regular sect cards · same phase · different levels"}</p><small class="relic-cultivation-rule">${isChinese ? "存入：修为 +1 · 取出：修为 −1" : "Store: +1 Cultivation · Take: −1 Cultivation"}</small></section>`;
  }

  function shelfZoneMarkup(zone, previous, owner) {
    const storage = seasonalZoneTransition({ ...zone, capacity: 2 }, previous).map(({ entry, previous: prior, change, slot }) =>
      `<div class="seasonal-slot stored-card-slot" data-zone-slot="${slot}">${transitionCard({ id: change === "leaving" ? prior : entry, change }, owner)}</div>`).join("");
    const choices = (zone.shelfChoices ?? []).map(choice => {
      const labels = isChinese ? { pending: "下轮获得", received: "已获得", available: "可选牌", locked: "未解锁" }
        : { pending: "Arrives next round", received: "Received", available: "Choice available", locked: "Locked" };
      const name = choice.cardId ? localizedInfo(recording.catalog.cards[choice.cardId]) || String(choice.cardId) : "";
      return `<li class="shelf-phase-choice ${esc(choice.status)}" data-shelf-phase="${esc(choice.phase)}"><span class="shelf-phase-label">${esc(phaseName(choice.phase))}</span>${choice.cardId ? `<span class="shelf-card-name" title="${esc(name)}">${esc(name)}</span>` : '<span class="shelf-card-name">—</span>'}<small>${esc(labels[choice.status] ?? "")}</small></li>`;
    }).join("");
    return `<section class="seasonal-zone shelf-zone" data-seasonal-zone="${esc(zone.id)}">${relicZoneHeading(zone)}<div class="shelf-workspace"><div class="shelf-storage"><small>${isChinese ? "存牌" : "Stored cards"}</small><div class="seasonal-zone-slots">${storage}</div><small class="relic-cultivation-rule">${isChinese ? "存入修为 +1 · 取出 −1" : "Store +1 Cultivation · Take −1"}</small></div>${choices ? `<div class="shelf-library"><strong>${isChinese ? "每个境界选择一张牌" : "One card per phase"}</strong><ol>${choices}</ol></div>` : ""}</div></section>`;
  }

  function renderSeasonalZones(state, previousState, isOwn, battle) {
    const mechanic = Number(state.seasonMechanic);
    const zones = isOwn && !battle && mechanic > 0 && mechanic < 9
      ? state.privatePlayer?.seasonalZones ?? [] : [];
    const previousZones = previousState?.privatePlayer?.uid === state.privatePlayer?.uid
      && Number(previousState?.seasonMechanic) === mechanic ? previousState.privatePlayer?.seasonalZones ?? [] : [];
    seasonalWorkspace.hidden = zones.length === 0;
    seasonalWorkspace.innerHTML = zones.map(zone => seasonalZoneMarkup(zone,
      previousZones.find(previous => previous.id === zone.id && previous.kind === zone.kind),
      state.players?.[state.privatePlayer?.uid])).join("");
    $("#board-panel").classList.toggle("has-seasonal-zones", zones.length > 0);
  }

  function renderChoice(overlay) {
    const host = $("#selection-overlay");
    if (!overlay) { host.hidden = true; host.innerHTML = ""; return; }
    const rerollsRemaining = Math.max(0, Number(overlay.rerollsRemaining) || 0);
    const showRerolls = (overlay.kind === "hundred-schools" && rerollsRemaining > 0)
      || (overlay.kind === "heavenly-derivation" && Number(overlay.roundOrPhase) !== 3);
    const canReroll = showRerolls && rerollsRemaining > 0;
    // An offer must not reveal a selection from a later recording step.
    const recordedSelected = Number(overlay.selected) || 0;
    const selectedOptionIndex = !recordedSelected
      ? -1
      : overlay.options.findIndex((reference) => Number(reference.id) === recordedSelected);
    let displayedOptions = overlay.options.map((reference, optionIndex) => ({ reference, optionIndex }));
    let omittedCardCount = 0;
    if (overlay.kind === "card-selection" && overlay.options.length > 6) {
      displayedOptions = displayedOptions.slice(0, 4);
      if (selectedOptionIndex >= 0 && !displayedOptions.some(({ optionIndex }) => optionIndex === selectedOptionIndex)) {
        displayedOptions.push({ reference: overlay.options[selectedOptionIndex], optionIndex: selectedOptionIndex });
      }
      if (displayedOptions.length < 5) {
        const fifth = overlay.options.map((reference, optionIndex) => ({ reference, optionIndex }))
          .find(({ optionIndex }) => !displayedOptions.some((entry) => entry.optionIndex === optionIndex));
        if (fifth) displayedOptions.push(fifth);
      }
      // Count only undisplayed options, whether this is an offer or its result.
      omittedCardCount = overlay.options.length - displayedOptions.length;
    }
    const options = displayedOptions.map(({ reference, optionIndex }) => {
      const selected = optionIndex === selectedOptionIndex;
      if (overlay.kind === "side-job" || overlay.kind === "additional-side-job") {
        return `<article class="selection-option${selected ? " selected" : ""}"><div class="selection-icon"><img src="${careerAsset(reference.id)}" alt="${esc(careerName(reference.id))}"></div><span class="chosen-mark${selected ? "" : " placeholder"}">${selected ? `✓ ${esc(copy.chosen)}` : "—"}</span><strong>${esc(careerName(reference.id))}</strong></article>`;
      }

      if (overlay.kind === "daoist-rhyme" || overlay.kind === "card-selection") {
        const info = recording.catalog.cards[reference.id] ?? {};
        return `<article class="selection-option card-choice${selected ? " selected" : ""}"><div class="selection-icon"><img data-asset-fallback src="${cardAsset(reference.id)}" alt=""></div><span class="chosen-mark${selected ? "" : " placeholder"}">${selected ? `✓ ${esc(copy.chosen)}` : "—"}</span><strong>${esc(localizedInfo(info) || reference.id)}</strong></article>`;
      }
      const kind = overlay.kind === "immortal-fate" ? "talent" : overlay.kind === "hundred-schools" ? "xianMoStrategy" : "fateStrategy";
      const info = kind === "talent" ? recording.catalog.talents[reference.id] : kind === "xianMoStrategy" ? recording.catalog.xianMoStrategies?.[reference.id] : recording.catalog.fateStrategies[reference.id];
      const name = localizedInfo(info) || reference.id;
      const optionCanReroll = canReroll && !(kind === "xianMoStrategy" && info?.isSkip);
      return `<article class="selection-option${selected ? " selected" : ""}"><div class="selection-icon">${fateArtwork(info ?? { id: reference.id }, kind, name)}</div>${optionCanReroll ? `<span class="reroll-slot">↻ <small>${optionIndex + 1}</small></span>` : ""}<span class="chosen-mark${selected ? "" : " placeholder"}">${selected ? `✓ ${esc(copy.chosen)}` : "—"}</span><strong>${esc(name)}</strong><p>${esc(localizedInfo(info, "description"))}</p></article>`;
    }).concat(omittedCardCount > 0
      ? [`<article class="selection-option card-choice selection-more"><div class="selection-icon"><span>${esc(copy.andOtherCards(omittedCardCount))}</span></div><span class="chosen-mark placeholder">—</span><strong>${esc(copy.andOtherCards(omittedCardCount))}</strong></article>`]
      : []).join("");
    const title = overlay.kind === "side-job"
      ? (isChinese ? "选择副职业" : "Select a Side Job")
      : overlay.kind === "additional-side-job"
        ? (isChinese ? "选择兼修副职业" : "Select an Additional Side Job")
        : overlay.kind === "hundred-schools"
          ? (isChinese ? "选择百家仙命" : "Select a Hundred Schools Fate")
        : overlay.kind === "heavenly-derivation"
      ? copy.selectHdf
      : overlay.kind === "immortal-fate"
        ? copy.selectTalent
        : copy.selectDaoYun;
    const roundOrPhase = overlay.kind === "side-job" || overlay.kind === "additional-side-job" || overlay.kind === "hundred-schools" || overlay.kind === "heavenly-derivation" || overlay.kind === "daoist-rhyme" || overlay.kind === "card-selection"
      ? `${copy.round}${esc(overlay.roundOrPhase)}${copy.roundSuffix}`
      : `${esc(phaseName(overlay.roundOrPhase))}`;
    host.dataset.kind = overlay.kind;
    host.innerHTML = `<div class="selection-frame" style="--choice-count:${displayedOptions.length + (omittedCardCount > 0 ? 1 : 0)}">
      <div class="selection-heading"><span class="selection-context">${roundOrPhase}</span><h2>${esc(title)}</h2><span class="selection-heading-spacer" aria-hidden="true"></span></div>
      <div class="selection-options">${options}</div>
      ${showRerolls ? `<div class="selection-actions"><span class="reroll-bank">↻ ${esc(rerollsRemaining)} ${esc(copy.rerollsRemaining)}</span></div>` : ""}
    </div>`;
    host.hidden = false;
  }

  function choiceOverlayForStep(state) {
    if (state.privatePlayer?.choiceOverlay) return state.privatePlayer.choiceOverlay;
    const previousState = states[index - 1];
    const privateUid = state.privatePlayer?.uid;
    if (!privateUid || previousState?.privatePlayer?.uid !== privateUid) return null;
    const currentTalents = state.players?.[privateUid]?.talents ?? [];
    const previousTalentIds = new Set((previousState?.players?.[privateUid]?.talents ?? []).map((reference) => Number(reference.id)));
    const chosenTalent = currentTalents.find((reference) => reference.choiceHistory?.selected
      && !previousTalentIds.has(Number(reference.id)));
    if (chosenTalent) {
      const history = chosenTalent.choiceHistory;
      return {
        kind: "immortal-fate",
        roundOrPhase: history.roundOrPhase,
        selected: history.selected,
        options: (history.offers?.at(-1) ?? []).map((id) => ({ id })),
      };
    }
    const previousFateIds = new Set((previousState?.privatePlayer?.selectedFateStrategies ?? []).map((reference) => Number(reference.id)));
    const chosenFate = (state.privatePlayer?.selectedFateStrategies ?? []).find((reference) => reference.choiceHistory?.selected
      && !previousFateIds.has(Number(reference.id)));
    if (chosenFate) {
      const history = chosenFate.choiceHistory;
      return {
        kind: "heavenly-derivation",
        roundOrPhase: history.roundOrPhase,
        rerollsRemaining: Number(history.rerollsRemaining ?? 0),
        selected: history.selected,
        options: (history.offers?.at(-1) ?? []).map((id) => ({ id })),
      };
    }
    const seasonalChoiceKey = (reference) => `${reference.choiceHistory?.roundOrPhase}:${reference.id}`;
    const previousSeasonalChoices = new Set((previousState?.privatePlayer?.selectedXianMoStrategies ?? []).map(seasonalChoiceKey));
    const chosenSeasonal = (state.privatePlayer?.selectedXianMoStrategies ?? []).find(reference => reference.choiceHistory?.selected && !previousSeasonalChoices.has(seasonalChoiceKey(reference)));
    if (chosenSeasonal) {
      const history = chosenSeasonal.choiceHistory;
      return { kind: "hundred-schools", roundOrPhase: history.roundOrPhase,
        rerollsRemaining: Number(history.rerollsRemaining ?? 0), selected: history.selected,
        options: (history.offers?.at(-1) ?? []).map(id => ({ id })) };
    }
    const choices = state.privatePlayer?.daoYunChoices ?? [];
    const previousChoices = previousState?.privatePlayer?.daoYunChoices ?? [];
    if (choices.length > previousChoices.length) {
      const choice = choices.at(-1);
      return {
        kind: "daoist-rhyme",
        roundOrPhase: choice.roundOrPhase,
        selected: choice.selected,
        options: (choice.offers?.at(-1) ?? []).map((id) => ({ id })),
      };
    }
    const cardSelections = state.privatePlayer?.cardSelections ?? [];
    const previousCardSelections = previousState?.privatePlayer?.cardSelections ?? [];
    if (cardSelections.length <= previousCardSelections.length) return null;
    const choice = cardSelections.at(-1);
    return {
      kind: "card-selection",
      roundOrPhase: choice.roundOrPhase,
      selected: choice.selected,
      options: (choice.offers?.at(-1) ?? []).map((id) => ({ id })),
    };
  }

  function recentActions() {
    return recording.steps.slice(0, index + 1)
      .flatMap((step, stepIndex) => (step.humanActions ?? []).map((action) => ({ ...action, current: stepIndex === index })))
      .slice(-5);
  }

  const actionText = (action) => action[isChinese ? "textChinese" : "textEnglish"] || action.text || "";
  const actionKindText = (action, mechanic = 10) => ["seasonalFate", "seasonalFateUse"].includes(action.kind) && Number(mechanic) > 0 && Number(mechanic) < 9
    ? seasonName(String(mechanic))
    : action.kind === "destiny" && Number(action.round) > 0
    ? isChinese ? `${copy.round}${action.round}${copy.roundSuffix}${copy.battle}` : `${copy.round}${action.round}${copy.roundSuffix} ${copy.battle}`
    : copy.actionKinds[action.kind] || action.kind;

  function renderActions() {
    const actions = recentActions();
    $("#action-list").innerHTML = actions.length
      ? actions.map((action) => `<li class="${action.current ? "current" : ""}"><span class="action-kind">${esc(actionKindText(action, states[index]?.seasonMechanic))}</span>${esc(actionText(action))}</li>`).join("")
      : `<li class="empty">${esc(copy.noActions)}</li>`;
  }

  function renderBattle(battle, playerUid) {
    const host = $("#battle-panel");
    const matchups = battle?.matchups ?? (battle?.players ? [{ players: battle.players }] : []);
    const matchup = matchups.find((entry) => entry.players?.[playerUid] && !entry.players[playerUid].innerDemon)
      ?? matchups.find((entry) => entry.players?.[playerUid]);
    const selectedBattlePlayer = matchup?.players?.[playerUid];
    const opponent = matchup?.players?.[selectedBattlePlayer?.opponentUid];
    const combatants = [selectedBattlePlayer, opponent].filter(Boolean);
    host.innerHTML = `<div class="battle-heading"><span>${copy.round}${esc(battle.round)}${copy.roundSuffix}</span><strong>${esc(copy.battleResult)}</strong></div>
      <div class="battle-combatants">${combatants.map((player) => {
        const talents = (player.talents ?? []).map((reference) => trait(reference, "talent")).join("");
        const fates = (player.fateStrategies ?? []).map(reference => trait(reference, "fateStrategy")).concat((player.xianMoStrategies ?? []).map(reference => trait(reference, "xianMoStrategy"))).join("");
        const buffs = (player.battleBuffs ?? []).map(battleBuff).join("");
        const delta = Number(player.lifeDelta ?? 0);
        const deltaText = delta ? `<span class="battle-destiny-delta ${delta > 0 ? "positive" : "negative"}">${delta > 0 ? "+" : ""}${esc(delta)}</span>` : "";
        const speed = Number(player.speed ?? 0);
        const physique = Number(player.physique ?? 0);
        const showPhysique = numericPrefix(player.sect) === 4 || physique > 0;
        return `<article class="battle-combatant ${esc(player.result)}">
          <div class="battle-player">
            <img data-character-fallback data-default-src="${characterAsset(player, "avatar", true)}" src="${characterAsset(player, "avatar")}" alt="">
            <div><strong>${esc(player.username)}${player.innerDemon ? isChinese ? `（${esc(copy.innerDemon)}）` : ` (${esc(copy.innerDemon)})` : ""}</strong><span>${esc(characterName(player))}</span><span>${esc(phaseName(player.phase))}${numericPrefix(player.career) ? ` · ${esc(careerName(player.career))}` : ""}</span></div>
            <b class="battle-result-stamp">${esc(copy[player.result] ?? copy.draw)}</b>
          </div>
          <div class="battle-values">
            <span><small>${esc(copy.destiny)}</small><strong>${esc(player.lifeBefore)}${deltaText}</strong></span>
            <span><small>${esc(copy.cultivation)}</small><strong>${esc(player.cultivation)}${speed > 0 ? `<em>(+${esc(speed)})</em>` : ""}</strong></span>
            ${showPhysique ? `<span><strong>${esc(physique)} / ${esc(player.maxPhysique ?? 0)} ${esc(copy.physique)}</strong></span>` : ""}
            ${player.first ? `<span class="battle-first">◆ ${esc(copy.firstAction)}</span>` : ""}
          </div>
          <div class="battle-effects">
            <div class="battle-effect-row battle-fates">${talents}</div>
            <div class="battle-effect-row battle-heavenly-fates">${fates}</div>
            <div class="battle-effect-row battle-temp-buffs">${buffs}</div>
            ${seasonalInfoMarkup(player.seasonalInfo, player.seasonalInfo?.mechanic, { compact: true })}
          </div>
          <div class="battle-deck">${(player.deck ?? []).map((id) => card(id, true, player)).join("")}</div>
        </article>`;
      }).join("")}</div>`;
  }

  function renderOpponentPreview(opponent) {
    const host = $("#opponent-preview");
    const prior = opponent?.lastRound;
    if (!opponent || !prior) {
      host.hidden = true;
      host.innerHTML = "";
      return false;
    }
    const talents = (prior.talents ?? []).map((reference) => trait(reference, "talent")).join("");
    const fates = (prior.fateStrategies ?? []).map(reference => trait(reference, "fateStrategy")).concat((prior.xianMoStrategies ?? []).map(reference => trait(reference, "xianMoStrategy"))).join("");
    const physique = Number(prior.physique ?? 0);
    const showPhysique = numericPrefix(opponent.sect) === 4 || physique > 0;
    host.innerHTML = `<div class="opponent-summary">
        <span class="opponent-kicker">${esc(copy.opponentLastRound)}</span>
        <strong title="${esc(opponent.username)}">${esc(opponent.username)}</strong>
        <div class="opponent-stats${showPhysique ? "" : " without-physique"}">
          <span><small>${esc(copy.cultivation)}</small><b>${esc(prior.cultivation ?? "—")}</b></span>
          ${showPhysique ? `<span><b>${esc(physique)} / ${esc(prior.maxPhysique ?? 0)} ${esc(copy.physique)}</b></span>` : ""}
          <span><small>${esc(copy.maxHp)}</small><b>${esc(priorMaxHp(prior) || "—")}</b></span>
        </div>
        <div class="opponent-effects"><div>${talents}</div><div>${fates}</div>${seasonalInfoMarkup(prior.seasonalInfo, prior.seasonalInfo?.mechanic, { compact: true })}</div>
      </div>
      <div class="opponent-deck">${(prior.deck ?? []).map((id) => card(id, true, prior)).join("") || `<span class="private-hand">${esc(copy.noDeck)}</span>`}</div>`;
    host.hidden = false;
    return true;
  }

  function render() {
    closeMobileTooltip();
    const state = states[index];
    if (!state) return;
    const battle = recording.steps[index]?.battle;
    const privatePlayer = state.privatePlayer;
    const privateOwnerUid = privatePlayer?.uid || recording.targetUid;
    const players = Object.values(state.players ?? {}).sort((first, second) =>
      (Number(first.rank) || 0) - (Number(second.rank) || 0));
    if (selectionFollowsPrivate || !selectedUid || !state.players[selectedUid]) {
      selectedUid = state.players[privateOwnerUid] ? privateOwnerUid : players[0]?.uid || "";
      selectionFollowsPrivate = true;
    }
    const selected = state.players[selectedUid] ?? players[0];
    const isOwn = selected?.uid === privateOwnerUid;
    const prior = isOwn ? null : selected?.lastRound;
    const deck = isOwn ? state.privatePlayer?.deck ?? [] : prior?.deck ?? [];
    const hand = isOwn ? state.privatePlayer?.hand ?? [] : null;
    const traits = isOwn
      ? { talents: selected?.talents, fates: state.privatePlayer?.selectedFateStrategies, xianMoFates: state.privatePlayer?.selectedXianMoStrategies }
      : { talents: prior?.talents, fates: prior?.fateStrategies, xianMoFates: prior?.xianMoStrategies };

    $(".game-stage").dataset.viewMode = battle ? "battle" : isOwn ? "private" : "prior-round";

    const emotes = new Map((recording.steps[index]?.humanActions ?? [])
      .filter((action) => action.kind === "emote" && action.emojiId != null)
      .map((action) => [action.actorUid, action.emojiId]));
    $("#player-roster").innerHTML = players.map((player) => playerPortrait(player, state, privateOwnerUid, emotes.get(player.uid))).join("");
    $("#round-marker").textContent = `${copy.round}${battle?.round || state.round || "—"}${copy.roundSuffix}`;
    $("#view-caption").textContent = battle
      ? `${selected?.username || recording.targetUsername} · ${copy.battleResult}`
      : isOwn
      ? `${copy.currentView} · ${selected?.username || recording.targetUsername}`
      : `${selected?.username} · ${copy.previousView}`;
    const showVase = !battle && isOwn && (selected?.talents ?? []).some(t => Number(t.id) === 199);
    vaseZone.hidden = !showVase;
    $(".hand-zone").classList.toggle("has-vase", showVase);
    renderSeasonalZones(state, states[index - 1], isOwn, battle);
    $("#vase-label").textContent = isChinese ? "五行玉瓶" : "Five Elements Pure Vase";
    $("#board-panel").hidden = Boolean(battle);
    $("#character-panel").hidden = Boolean(battle);
    $("#battle-panel").hidden = !battle;
    if (battle) {
      renderBattle(battle, selectedUid);
    } else {
      const opponent = isOwn ? state.players[selected?.nextOpponent] : null;
      const hasOpponentPreview = renderOpponentPreview(opponent);
      $("#board-panel").classList.toggle("has-opponent-preview", hasOpponentPreview);
      $("#deck-label").textContent = isOwn ? copy.deck : copy.previousDeck;
      const transition = isOwn ? cardTransition(states[index - 1], state, recording.steps[index]) : null;
      $("#deck").innerHTML = (transition ? transitionDeck(transition, selected, states[index - 1]?.players?.[selected?.uid], privatePlayer?.selectedXianMoStrategies ?? []) : deck.map(id => card(id, true, isOwn ? selected : prior)).join("")) || `<span class="private-hand">${esc(copy.noDeck)}</span>`;
      $("#vase").innerHTML = showVase ? transition.vase.map((entry, slot) =>
        `<div class="vase-slot" data-vase-slot="${slot + 1}" aria-label="${isChinese ? "玉瓶格" : "Vase slot"} ${slot + 1}">${transitionCard(entry)}</div>`).join("") : "";
      $("#hand-label").textContent = isOwn ? `${copy.hand} · ${hand?.length ?? 0}` : copy.hand;
      $("#hand").innerHTML = transition ? transition.hand.map(entry => transitionCard(entry, entry.change === "leaving" ? states[index - 1]?.players?.[selected?.uid] : selected)).join("") : `<span class="private-hand">${esc(copy.hiddenHand)}</span>`;
    }
    const exchangeCounter = $("#exchange-counter");
    exchangeCounter.hidden = Boolean(battle) || !isOwn;
    const exchangeLimit = Number(privatePlayer?.exchangeLimit);
    exchangeCounter.textContent = isOwn
      ? `${privatePlayer?.exchangesRemaining ?? "—"}${Number.isFinite(exchangeLimit) && exchangeLimit > 0 ? `/${exchangeLimit}` : ""}`
      : "";
    exchangeCounter.title = copy.exchangeChance;
    if (!battle) renderCharacter(selected, traits, state, prior, privateOwnerUid);
    renderChoice(!battle && isOwn ? choiceOverlayForStep(state) : null);
    renderActions();

    timeline.value = index;
    previous.disabled = index === 0;
    next.disabled = index === recording.steps.length - 1;
    $("#step-label").textContent = `${index + 1} / ${recording.steps.length}`;
    $("#recording-meta").textContent = recording.targetUsername;
    document.querySelectorAll(".player-portrait").forEach((button) => button.addEventListener("click", () => {
      selectedUid = button.dataset.uid;
      selectionFollowsPrivate = selectedUid === privateOwnerUid;
      render();
    }));
    if (matchMedia("(max-width: 760px)").matches) {
      const selectedPortrait = document.querySelector(".player-portrait.selected");
      if (selectedPortrait) {
        const roster = $("#player-roster");
        roster.scrollLeft = Math.max(0, selectedPortrait.offsetLeft - (roster.clientWidth - selectedPortrait.offsetWidth) / 2);
      }
    }
  }

  function requestedLocation() {
    const params = new URLSearchParams(location.search);
    const requestedStep = Number.parseInt(params.get("step") ?? "", 10);
    return {
      recordingId: params.get("recording") || "",
      season: params.get("season"),
      stepIndex: Number.isFinite(requestedStep) && requestedStep > 0 ? requestedStep - 1 : null,
    };
  }

  function updateLanguageLink(url) {
    const link = $(".lang");
    if (!link) return;
    const target = new URL(link.href, location.href);
    target.search = url.search;
    target.hash = url.hash;
    link.href = target.href;
  }

  function filterNumbers(params, name) {
    return new Set(params.getAll(name)
      .flatMap((value) => value.split(","))
      .map(Number)
      .filter((value) => Number.isInteger(value) && value > 0));
  }

  function filterStateFromParams(params) {
    return {
      fates: filterNumbers(params, "fates"),
      unchosenFates: filterNumbers(params, "unchosenFates"),
      career: Math.max(0, Number.parseInt(params.get("career") ?? "0", 10) || 0),
      opponents: filterNumbers(params, "opponents"),
    };
  }

  function replaceFilterState(nextState) {
    replayFilters.fates = nextState.fates;
    replayFilters.unchosenFates = nextState.unchosenFates;
    replayFilters.career = nextState.career;
    replayFilters.opponents = nextState.opponents;
  }

  function writeFilterState(url) {
    if (selectedSeason != null) url.searchParams.set("season", selectedSeason);
    else url.searchParams.delete("season");
    for (const [name, values] of [
      ["fates", replayFilters.fates],
      ["unchosenFates", replayFilters.unchosenFates],
      ["opponents", replayFilters.opponents],
    ]) {
      url.searchParams.delete(name);
      if (values.size) url.searchParams.set(name, [...values].sort((first, second) => first - second).join(","));
    }
    url.searchParams.delete("career");
    if (replayFilters.career > 0) url.searchParams.set("career", String(replayFilters.career));
    return url;
  }

  function syncFilterLocation() {
    const url = writeFilterState(new URL(location.href));
    history.replaceState(history.state, "", url);
    updateLanguageLink(url);
  }

  function syncLocation(mode = "replace") {
    if (!recording || !activeCatalogItem) return;
    const url = new URL(location.href);
    url.searchParams.set("recording", activeCatalogItem.id);
    url.searchParams.set("step", String(index + 1));
    writeFilterState(url);
    history[mode === "push" ? "pushState" : "replaceState"](
      { recordingId: activeCatalogItem.id, step: index + 1 },
      "",
      url,
    );
    updateLanguageLink(url);
  }

  function syncPendingRecordingLocation(item, mode = "push") {
    const url = new URL(location.href);
    url.searchParams.set("recording", item.id);
    url.searchParams.delete("step");
    writeFilterState(url);
    history[mode === "push" ? "pushState" : "replaceState"](
      { recordingId: item.id }, "", url,
    );
    updateLanguageLink(url);
  }

  function navigateToRecording(item, { historyMode = "push" } = {}) {
    if (!item) return;
    select.value = item.id;
    syncPendingRecordingLocation(item, historyMode);
    loadRecording(item, { historyMode: "replace" });
  }

  function setIndex(value, sync = true) {
    if (!recording || $("#viewer").hidden) return;
    index = Math.max(0, Math.min(recording.steps.length - 1, Number(value)));
    render();
    if (sync) syncLocation();
  }

  function installRecording(data, item, requestedStepIndex, historyMode) {
    recording = data;
    activeCatalogItem = item;
    states = hydrateStates(data);
    const resultSummary = $("#recording-result");
    if (resultSummary) {
      const preseason = seasonForItem(item) === "10-preseason";
      const noSeasonalChoices = Number(item.seasonMechanic) === 10 && item.seasonMechanicEnabled == null && !states.some(state =>
        state.privatePlayer?.selectedXianMoStrategies?.length || state.privatePlayer?.choiceOverlay?.kind === "hundred-schools"
        || Object.values(state.players ?? {}).some(player => player.lastRound?.xianMoStrategies?.length));
      const note = preseason ? (isChinese ? " · 本场对局未启用百家之道" : " · Hundred Schools was not enabled in this match")
        : noSeasonalChoices ? (isChinese ? " · 此录像未包含百家之道选项" : " · Hundred Schools choices were not included in this recording") : "";
      resultSummary.textContent = recordingLabel(item) + note;
      resultSummary.hidden = false;
    }
    const firstRecordedIndex = states.findIndex((state) => state.round > 0);
    index = requestedStepIndex == null ? Math.max(0, firstRecordedIndex) : requestedStepIndex;
    index = Math.max(0, Math.min(data.steps.length - 1, index));
    selectedUid = data.targetUid;
    selectionFollowsPrivate = true;
    timeline.max = data.steps.length - 1;
    timeline.disabled = roundSelect.disabled = false;
    const firstByRound = new Map();
    states.forEach((state, stateIndex) => { if (state.round && !firstByRound.has(state.round)) firstByRound.set(state.round, stateIndex); });
    roundSelect.innerHTML = `<option value="">${esc(copy.jumpRound)}</option>` + [...firstByRound].map(([round, stateIndex]) => `<option value="${stateIndex}">${copy.round}${round}${copy.roundSuffix}</option>`).join("");
    $("#loading").hidden = true;
    $("#viewer").hidden = false;
    render();
    syncLocation(historyMode);
  }

  function loadRecording(item, { stepIndex = null, historyMode = "replace" } = {}) {
    if (!item) return;
    closeMobileTooltip();
    const generation = ++loadGeneration;
    $("#loading").hidden = false;
    $("#loading").textContent = copy.loading;
    $("#viewer").hidden = true;
    $("#recording-result").hidden = true;
    previous.disabled = next.disabled = timeline.disabled = roundSelect.disabled = true;
    loadCompressedJson(versionedUrl(item.file))
      .then((packed) => window.RECORDING_CODEC.unpackRecording(packed, sharedCatalog))
      .then((data) => {
        if (generation !== loadGeneration) return;
        installRecording(data, item, stepIndex, historyMode);
      })
      .catch((error) => {
        console.error(`could not load recording ${item.file}`, error);
        if (generation === loadGeneration) $("#loading").textContent = `${copy.couldNotLoad} ${item.file}`;
      });
  }

  const recordingLabel = (item) => {
    if (!item.targetUsername || !item.rounds) return item.label;
    const parts = [item.targetUsername, `${item.rounds} ${copy.rounds}`];
    if (Number.isInteger(item.placementStart) && item.placementStart > 0) {
      const average = (item.placementStart + item.placementEnd) / 2;
      const ordinal = n => `${n}${n === 1 ? "st" : n === 2 ? "nd" : n === 3 ? "rd" : "th"}`;
      parts.push(isChinese ? `第${average}名` : ordinal(average));
    }
    if (Number(item.gameMode) === 6) {
      parts.push(item.cupStage === "final" ? copy.cupFinal
        : item.cupStage === "preliminary" ? copy.cupPreliminary : copy.cup);
    } else if (item.practice) {
      parts.push(copy.practice);
    } else if (Number.isFinite(item.startingRating) && item.startingRating > 0) {
      const kind = item.ratingKind === "dao" ? (isChinese ? "道心分" : "Dao Mind rating") : copy.rating;
      const change = Number.isFinite(item.ratingChange)
        ? ` (${item.ratingChange > 0 ? "+" : ""}${item.ratingChange})`
        : Number(item.gameMode) === 3 ? (isChinese ? "（分数变化未知）" : " (change unavailable)") : "";
      parts.push(`${item.startingRating} ${kind}${change}`);
    }
    if (numericPrefix(item.career) > 0) parts.push(careerName(item.career));
    if (item.capturedThrough) parts.push(`${item.capturedThrough.slice(0, 16).replace("T", " ")} UTC`);
    return parts.join(" · ");
  };
  const legacyRecordingAliases = new Map([
    ["r-8429f9ca71dd2f18", "r-5b2e107c8e668b62"],
    ["r-36ad1a94e89e3947", "r-0222490fe4a782ee"],
  ]);
  const catalogItemForId = (id) => catalog.find((candidate) =>
    candidate.id === (legacyRecordingAliases.get(id) ?? id));
  const seasonForItem = (item) => {
    if (item?.seasonMechanic == null || !Number.isInteger(Number(item.seasonMechanic))) return "unknown";
    if (Number(item.seasonMechanic) === 10 && item.seasonMechanicEnabled === false) return "10-preseason";
    return String(Number(item.seasonMechanic));
  };
  const isHundredSchoolsSeason = (season) => season === "10" || season === "10-preseason";
  const availableSeasons = [...new Set(catalog.map(seasonForItem))]
    .sort((first, second) => first === "unknown" ? 1 : second === "unknown" ? -1
      : Number.parseInt(second, 10) - Number.parseInt(first, 10)
        || Number(first === "10-preseason") - Number(second === "10-preseason"));
  let selectedSeason = null;
  const replayFilters = filterStateFromParams(new URLSearchParams(location.search));
  let seasonCatalog = [];
  let filteredCatalog = [];
  const uniqueFilterEntries = (values) => [...new Map(values.map((value) => [Number(value.id), value])).values()]
    .sort((first, second) => localizedInfo(first).localeCompare(localizedInfo(second)));
  let filterFates = [], filterUnchosenFates = [], filterOpponents = [], filterCareers = [];

  function seasonName(season) {
    const names = {
      0: ["No season mechanic", "无赛季机制"],
      1: ["Luck", "气运"],
      2: ["Life Shop", "命坊"],
      3: ["Fate Branches", "命运分支"],
      4: ["Relics", "遗迹法器"],
      5: ["Resonance Immortal Fate", "共鸣仙命"],
      6: ["Mirage", "幻景"],
      7: ["Sigil", "刻印"],
      8: ["Dream", "梦境"],
      9: ["Heavenly Derivation Fate", "天衍仙命"],
      10: ["The Dao of Hundred Schools", "百家之道"],
      "10-preseason": ["Hundred Schools pre-season", "百家之道·季前赛"],
      unknown: ["Unknown season mechanic", "未知赛季机制"],
    };
    return localizedPair(names[season], isChinese ? `赛季机制 ${season}` : `Season mechanic ${season}`);
  }

  function seasonFromLocation(requested) {
    const item = catalogItemForId(requested.recordingId);
    // Existing links used season=10 for both enabled and pre-season matches.
    // Keep their recording and step when migrating the pre-season category.
    if (requested.season === "10" && seasonForItem(item) === "10-preseason") return "10-preseason";
    if (availableSeasons.includes(requested.season)) return requested.season;
    return item ? seasonForItem(item) : availableSeasons[0] ?? null;
  }

  function setSeason(season) {
    selectedSeason = season;
    seasonCatalog = catalog.filter((item) => seasonForItem(item) === season);
    const fateField = isHundredSchoolsSeason(season) ? "linXianMoFates" : "linFates";
    const unchosenFateField = isHundredSchoolsSeason(season) ? "linUnchosenXianMoFates" : "linUnchosenFates";
    filterFates = uniqueFilterEntries(seasonCatalog.flatMap((item) => item[fateField] ?? []));
    filterUnchosenFates = uniqueFilterEntries(seasonCatalog.flatMap((item) => item[unchosenFateField] ?? []));
    filterOpponents = uniqueFilterEntries(seasonCatalog.flatMap((item) => item.humanOpponentCharacters ?? []));
    filterCareers = [...new Set(seasonCatalog.map((item) => numericPrefix(item.linCareer)).filter((value) => value > 0))]
      .sort((first, second) => first - second);
    // Preserve applicable filters, but never leave an invisible old-season
    // constraint selected after changing mechanics or opening an older link.
    for (const [kind, entries] of [["fates", filterFates], ["unchosenFates", filterUnchosenFates], ["opponents", filterOpponents]]) {
      const available = new Set(entries.map((entry) => Number(entry.id)));
      replayFilters[kind] = new Set([...replayFilters[kind]].filter((id) => available.has(id)));
    }
    if (!filterCareers.includes(replayFilters.career)) replayFilters.career = 0;
    if (seasonSelect) {
      seasonSelect.innerHTML = availableSeasons.map((value) => `<option value="${esc(value)}">${esc(seasonName(value))}</option>`).join("");
      seasonSelect.value = season ?? "";
      seasonSelect.disabled = !availableSeasons.length;
    }
  }

  function filterCount() {
    return replayFilters.fates.size + replayFilters.unchosenFates.size + replayFilters.opponents.size + (replayFilters.career > 0 ? 1 : 0);
  }

  function renderRecordingFilters() {
    const checkbox = (kind, entry, checked) => `<label><input type="checkbox" data-filter-kind="${kind}" value="${esc(entry.id)}"${checked ? " checked" : ""}>${esc(localizedInfo(entry))}</label>`;
    const fateLabel = isHundredSchoolsSeason(selectedSeason) ? (isChinese ? "已选择的百家仙命" : "Chosen Hundred Schools Fates") : copy.heavenlyFateFilter;
    const unchosenLabel = isHundredSchoolsSeason(selectedSeason) ? (isChinese ? "出现但未选择的百家仙命" : "Offered but not chosen") : copy.unchosenHeavenlyFateFilter;
    filterPopover.innerHTML = `<div class="recording-filter-head"><strong>${esc(copy.filters)}</strong><button type="button" data-clear-filters>${esc(copy.clearFilters)}</button></div>
      ${filterFates.length ? `<fieldset><legend>${esc(fateLabel)}</legend><div class="recording-filter-options">${filterFates.map((entry) => checkbox("fates", entry, replayFilters.fates.has(Number(entry.id)))).join("")}</div></fieldset>` : ""}
      ${filterUnchosenFates.length ? `<fieldset><legend>${esc(unchosenLabel)}</legend><div class="recording-filter-options">${filterUnchosenFates.map((entry) => checkbox("unchosenFates", entry, replayFilters.unchosenFates.has(Number(entry.id)))).join("")}</div></fieldset>` : ""}
      <fieldset><legend>${esc(copy.sideJobFilter)}</legend><select data-career-filter><option value="0">${esc(copy.anySideJob)}</option>${filterCareers.map((career) => `<option value="${career}"${replayFilters.career === career ? " selected" : ""}>${esc(careerName(career))}</option>`).join("")}</select></fieldset>
      <fieldset><legend>${esc(copy.opponentFilter)}</legend><div class="recording-filter-options">${filterOpponents.map((entry) => checkbox("opponents", entry, replayFilters.opponents.has(Number(entry.id)))).join("")}</div></fieldset>`;
    filterToggle.innerHTML = `☷${filterCount() ? `<span>${filterCount()}</span>` : ""}`;
    filterPopover.querySelectorAll("input[data-filter-kind]").forEach((input) => input.addEventListener("change", () => {
      const target = replayFilters[input.dataset.filterKind];
      if (input.checked) target.add(Number(input.value)); else target.delete(Number(input.value));
      applyRecordingFilters();
      renderRecordingFilters();
    }));
    filterPopover.querySelector("[data-career-filter]")?.addEventListener("change", (event) => {
      replayFilters.career = Number(event.target.value);
      applyRecordingFilters();
      renderRecordingFilters();
    });
    filterPopover.querySelector("[data-clear-filters]")?.addEventListener("click", () => {
      replayFilters.fates.clear(); replayFilters.unchosenFates.clear(); replayFilters.opponents.clear(); replayFilters.career = 0;
      applyRecordingFilters();
      renderRecordingFilters();
    });
  }

  function preferredRecording(items) {
    return items.find((item) => item.targetUid === preferredTargetUid) ?? items[0];
  }

  function clearRecording() {
    // Invalidate an in-flight fetch, otherwise it can restore a now-hidden
    // recording after a filter or browser-history change.
    loadGeneration++;
    recording = activeCatalogItem = null;
    states = [];
    $("#viewer").hidden = true;
    $("#recording-result").hidden = true;
    $("#loading").hidden = false;
    $("#loading").textContent = catalog.length ? copy.noMatchingRecordings : copy.noRecordings;
    previous.disabled = next.disabled = timeline.disabled = roundSelect.disabled = true;
    roundSelect.innerHTML = "";
    timeline.value = 0;
    $("#step-label").textContent = "—";
  }

  function syncEmptyLocation(mode = "replace") {
    const url = writeFilterState(new URL(location.href));
    url.searchParams.delete("recording");
    url.searchParams.delete("step");
    history[mode === "push" ? "pushState" : "replaceState"]({}, "", url);
    updateLanguageLink(url);
  }

  function applyRecordingFilters({ navigate = true, sync = true, historyMode = "push" } = {}) {
    const fateField = isHundredSchoolsSeason(selectedSeason) ? "linXianMoFates" : "linFates";
    const unchosenFateField = isHundredSchoolsSeason(selectedSeason) ? "linUnchosenXianMoFates" : "linUnchosenFates";
    filteredCatalog = seasonCatalog.filter((item) =>
      (!replayFilters.career || numericPrefix(item.linCareer) === replayFilters.career)
      && [...replayFilters.fates].every((id) => (item[fateField] ?? []).some((entry) => Number(entry.id) === id))
      && [...replayFilters.unchosenFates].every((id) => (item[unchosenFateField] ?? []).some((entry) => Number(entry.id) === id))
      && [...replayFilters.opponents].every((id) => (item.humanOpponentCharacters ?? []).some((entry) => Number(entry.id) === id)));
    const currentId = select.value || activeCatalogItem?.id;
    select.innerHTML = filteredCatalog.length
      ? filteredCatalog.map((item) => `<option value="${esc(item.id)}">${esc(recordingLabel(item))}</option>`).join("")
      : `<option value="">${esc(copy.noMatchingRecordings)}</option>`;
    select.disabled = filteredCatalog.length === 0;
    const currentStillVisible = filteredCatalog.some((item) => item.id === currentId);
    if (currentStillVisible) select.value = currentId;
    else if (navigate && filteredCatalog.length) navigateToRecording(preferredRecording(filteredCatalog), { historyMode });
    if (!filteredCatalog.length && navigate) {
      clearRecording();
      if (sync) syncEmptyLocation(historyMode);
    } else if (sync) syncFilterLocation();
  }

  function restoreLocation() {
    const requested = requestedLocation();
    replaceFilterState(filterStateFromParams(new URLSearchParams(location.search)));
    setSeason(seasonFromLocation(requested));
    applyRecordingFilters({ navigate: false, sync: false });
    renderRecordingFilters();
    const requestedItem = catalogItemForId(requested.recordingId);
    const item = filteredCatalog.find((candidate) => candidate.id === requestedItem?.id)
      ?? preferredRecording(filteredCatalog);
    if (!item) {
      clearRecording();
      syncEmptyLocation();
      return;
    }
    select.value = item.id;
    const stepIndex = item.id === requestedItem?.id ? requested.stepIndex : null;
    if (recording && activeCatalogItem?.id === item.id) {
      // Also cancel a pending recording request when back/forward returns to
      // the replay already in memory.
      loadGeneration++;
      $("#loading").hidden = true;
      $("#viewer").hidden = false;
      $("#recording-result").hidden = false;
      timeline.disabled = roundSelect.disabled = false;
      setIndex(stepIndex ?? Math.max(0, states.findIndex((state) => state.round > 0)));
    } else loadRecording(item, { stepIndex, historyMode: "replace" });
  }

  seasonSelect?.addEventListener("change", () => {
    // IDs from different fate catalogs can overlap. A previous mechanic's
    // fate selection must not silently select another mechanic's fate.
    replayFilters.fates.clear();
    replayFilters.unchosenFates.clear();
    setSeason(seasonSelect.value);
    applyRecordingFilters();
    renderRecordingFilters();
  });
  filterToggle.addEventListener("click", () => {
    filterPopover.hidden = !filterPopover.hidden;
    filterToggle.setAttribute("aria-expanded", String(!filterPopover.hidden));
  });
  document.addEventListener("click", (event) => {
    const tooltipTrigger = event.target.closest(".trait-icon, .battle-buff, .dao-yun-choice, .card-selection-choice, .seasonal-trait, .seasonal-rules, .sigil-item");
    if (tooltipTrigger && (mobileViewport.matches || tooltipTrigger.matches(".seasonal-trait, .seasonal-rules, .sigil-item"))) {
      event.preventDefault();
      openMobileTooltip(tooltipTrigger, true);
      return;
    }
    if (!filterPopover.hidden && !event.target.closest(".recording-picker-row")) {
      filterPopover.hidden = true;
      filterToggle.setAttribute("aria-expanded", "false");
    }
  });
  mobileTooltipLayer.addEventListener("click", (event) => {
    if (event.target === mobileTooltipLayer || event.target.closest(".mobile-tooltip-close")) closeMobileTooltip();
  });
  mobileViewport.addEventListener("change", closeMobileTooltip);
  select.addEventListener("change", () => navigateToRecording(catalog.find((item) => item.id === select.value)));
  previous.addEventListener("click", () => setIndex(index - 1));
  next.addEventListener("click", () => setIndex(index + 1));
  timeline.addEventListener("input", (event) => setIndex(event.target.value));
  roundSelect.addEventListener("change", (event) => { if (event.target.value !== "") setIndex(event.target.value); });
  addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !mobileTooltipLayer.hidden) {
      closeMobileTooltip();
      return;
    }
    if (["INPUT", "SELECT"].includes(document.activeElement?.tagName)) return;
    if (event.key === "ArrowLeft") setIndex(index - 1);
    if (event.key === "ArrowRight") setIndex(index + 1);
  });
  addEventListener("popstate", restoreLocation);
  addEventListener("error", (event) => {
    if (event.target instanceof HTMLImageElement && event.target.matches("img[data-character-fallback]")) {
      if (!event.target.dataset.fallbackApplied) {
        event.target.dataset.fallbackApplied = "true";
        event.target.src = event.target.dataset.defaultSrc;
      } else event.target.hidden = true;
      return;
    }
    if (event.target instanceof HTMLImageElement && event.target.matches("img[data-asset-fallback]")) event.target.hidden = true;
    if (event.target instanceof HTMLImageElement && event.target.matches("img[data-emote-art]")) event.target.hidden = true;
  }, true);
  restoreLocation();
})().catch((error) => {
  console.error("could not initialize recording browser", error);
  const loading = document.querySelector("#loading");
  if (loading) loading.textContent = document.documentElement.lang.toLowerCase().startsWith("zh")
    ? "无法载入录像。" : "Could not load recordings.";
});
